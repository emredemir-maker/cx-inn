import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { interactionRecordsTable, customersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/requireRole";
import { sanitizeError } from "../../lib/sanitize-error";
import { writeAuditLog, getUserId } from "../../lib/audit";
import { isExcel, isInfosetFormat, mapInfosetRow, mapStandardRow, classifyIrrelevant } from "../../lib/interaction-import-mappers";
import { excludedDomainsTable } from "@workspace/db/schema";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── TEMPLATE DATA ────────────────────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  "customer_email", "type", "subject", "content",
  "status", "channel", "agent_name", "duration_seconds", "resolution", "interacted_at",
];
const TEMPLATE_ROWS = [
  ["ahmet.yilmaz@sirket.com", "ticket", "Fatura Hatası", "Geçen ay fazladan fatura kesildi. Hesap ekstremi incelediğimde XX TL fazla tahsilat gördüm.", "open", "email", "Zeynep K.", "", "", "2026-03-10T09:00:00"],
  ["zeynep.kaya@firma.com", "chat", "Ürün iade talebi", "Aldığım ürün hasarlı geldi müşteri destek hattını aradım ancak yanıt alamadım.", "resolved", "chat", "Can D.", "", "Ürün değiştirildi", "2026-03-11T14:30:00"],
  ["can.demir@startup.io", "call", "Servis şikayeti", "Teknik destek için 3 kez aradım her seferinde bekleme süresi 20 dakikayı aştı.", "escalated", "phone", "Mehmet A.", "1320", "Üst yönetime iletildi", "2026-03-12T11:15:00"],
];

// ─── CSV TEMPLATE ─────────────────────────────────────────────────────────────
router.get("/interaction-records/template", (_req, res) => {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=etkilesim_sablonu.csv");
  res.send("\uFEFF" + rows);
});

// ─── XLSX TEMPLATE ────────────────────────────────────────────────────────────
router.get("/interaction-records/template-xlsx", (_req, res) => {
  const wb = XLSX.utils.book_new();
  const wsData = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 30 }, { wch: 10 }, { wch: 28 }, { wch: 60 },
    { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Etkileşimler");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=etkilesim_sablonu.xlsx");
  res.send(Buffer.from(buf));
});

// ─── BULK IMPORT ──────────────────────────────────────────────────────────────
router.post("/interaction-records/bulk", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi." });

  let records: Record<string, string>[];
  try {
    if (isExcel(req.file)) {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false, raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) return res.status(400).json({ error: "Excel dosyası boş veya başlık satırı eksik." });
      records = raw.map((row) => {
        const obj: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          obj[String(k).trim()] = v !== null && v !== undefined ? String(v).trim() : "";
        }
        return obj;
      });
    } else {
      records = parse(req.file.buffer.toString("utf-8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    }
  } catch (e: any) {
    return res.status(400).json({ error: "Dosya ayrıştırma hatası: " + e.message });
  }

  if (!records.length) return res.status(400).json({ error: "Dosya boş veya başlık satırı eksik." });

  const isInfoset = isInfosetFormat(records);
  const detectedColumns = Object.keys(records[0] ?? {}).join(", ");

  // Fetch excluded domains once for the whole import
  const excludedDomainRows = await db.select({ domain: excludedDomainsTable.domain }).from(excludedDomainsTable);
  const excludedDomainSet = new Set(excludedDomainRows.map((r) => r.domain.toLowerCase()));
  const newlyDetectedDomains = new Set<string>(); // domains auto-detected during this import

  // Build email→id lookup
  const allCustomers = await db
    .select({ id: customersTable.id, email: customersTable.email })
    .from(customersTable);
  const emailToId: Record<string, number> = {};
  for (const c of allCustomers) emailToId[c.email.toLowerCase()] = c.id;

  let imported = 0;
  let skipped = 0;
  let customersCreated = 0;
  let autoExcluded = 0;
  const errors: string[] = [];
  const importedCustomerIds = new Set<number>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    const mapped = isInfoset ? mapInfosetRow(row) : mapStandardRow(row);
    const { email, name, company, subject, content, type, status, channel, agentName, durationSeconds, resolution, interactedAt } = mapped;

    if (!email) {
      // Only add column hint in the first email error to avoid flooding the output
      const colHint = errors.filter((e) => e.includes("E-posta adresi boş")).length === 0
        ? ` (Tespit edilen sütunlar: ${detectedColumns})`
        : "";
      errors.push(`Satır ${rowNum}: E-posta adresi boş.${colHint}`);
      skipped++; continue;
    }
    if (!subject) { errors.push(`Satır ${rowNum}: Konu boş.`); skipped++; continue; }

    if (!isInfoset) {
      if (!["ticket", "chat", "call"].includes(type)) {
        errors.push(`Satır ${rowNum}: type değeri ticket | chat | call olmalıdır (bulunan: "${type}").`);
        skipped++; continue;
      }
      if (!content) { errors.push(`Satır ${rowNum}: content boş.`); skipped++; continue; }
    }

    // Auto-create customer for Infoset imports; require existing for standard
    let customerId = emailToId[email];
    if (!customerId) {
      if (isInfoset && email && name) {
        try {
          const [newCustomer] = await db
            .insert(customersTable)
            .values({
              name: name.trim(),
              email,
              company: company ? company.trim() : null,
              segment: "Genel", // segment is set by AI analysis or user, not by import
            })
            .returning({ id: customersTable.id });
          customerId = newCustomer.id;
          emailToId[email] = customerId;
          customersCreated++;
        } catch (e: any) {
          errors.push(`Satır ${rowNum}: Müşteri oluşturulamadı (${email}) — ${e.message}`);
          skipped++; continue;
        }
      } else {
        errors.push(`Satır ${rowNum}: "${email}" e-postasına sahip müşteri bulunamadı.`);
        skipped++; continue;
      }
    } else if (isInfoset && company) {
      // Update company for existing customer if it was not set
      await db.execute(
        sql`UPDATE customers SET company = ${company.trim()} WHERE id = ${customerId} AND (company IS NULL OR company = '')`,
      );
    }

    if (interactedAt && isNaN(interactedAt.getTime())) {
      errors.push(`Satır ${rowNum}: Geçersiz tarih formatı.`);
      skipped++; continue;
    }

    // ── Domain-based exclusion (checked before pattern classifier) ────────────
    const emailDomain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";
    const isDomainExcluded = emailDomain && excludedDomainSet.has(emailDomain);

    // ── Pattern-based classifier (no-reply, notifications, marketing, etc.) ──
    const { excluded: isPatternExcluded, reason: patternReason } = classifyIrrelevant(email, subject, content);

    // If pattern classifier fires, auto-register the domain for future imports
    if (isPatternExcluded && emailDomain && !excludedDomainSet.has(emailDomain) && !newlyDetectedDomains.has(emailDomain)) {
      newlyDetectedDomains.add(emailDomain);
      excludedDomainSet.add(emailDomain); // update in-memory set for this run
      // Persist asynchronously — don't block the import loop
      db.insert(excludedDomainsTable)
        .values({ domain: emailDomain, reason: patternReason ?? "Otomatik tespit", source: "auto" })
        .onConflictDoNothing()
        .catch((e: Error) => console.error("[import] auto-domain persist error:", e));
    }

    const isIrrelevant = isDomainExcluded || isPatternExcluded;
    const exclusionReason = isDomainExcluded
      ? `Domain hariç tutma listesi: ${emailDomain}`
      : (patternReason ?? null);

    try {
      await db.insert(interactionRecordsTable).values({
        customerId,
        type: (["ticket", "chat", "call"].includes(type) ? type : "ticket") as "ticket" | "chat" | "call",
        subject,
        content: content || subject,
        status: status as any,
        channel,
        agentName,
        durationSeconds,
        resolution,
        interactedAt,
        excludedFromAnalysis: isIrrelevant,
      });
      importedCustomerIds.add(customerId);
      imported++;
      if (isIrrelevant) autoExcluded++;
    } catch (e: any) {
      errors.push(`Satır ${rowNum}: DB hatası — ${e.message}`);
      skipped++;
    }
  }

  await writeAuditLog(
    "BULK_IMPORT_INTERACTIONS",
    "interaction_records",
    null,
    getUserId(req.user),
    `Toplu etkileşim içe aktarma: ${imported} kayıt eklendi (${autoExcluded} otomatik hariç tutuldu), ${skipped} atlandı, ${customersCreated} yeni müşteri oluşturuldu. Dosya: ${req.file.originalname}`,
  );

  res.json({
    total: records.length,
    imported,
    skipped,
    autoExcluded,
    customersCreated,
    importedCustomerIds: [...importedCustomerIds],
    errors: errors.slice(0, 30),
  });
});

export default router;
