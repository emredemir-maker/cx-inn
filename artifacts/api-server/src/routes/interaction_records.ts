import { Router, type IRouter } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { interactionRecordsTable, customersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, desc, inArray, isNull, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { analyzeCustomer } from "../lib/analyze";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── LIST ───────────────────────────────────────────────────────────────────
router.get("/interaction-records", async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const query = db
      .select({
        id: interactionRecordsTable.id,
        customerId: interactionRecordsTable.customerId,
        customerName: customersTable.name,
        type: interactionRecordsTable.type,
        subject: interactionRecordsTable.subject,
        content: interactionRecordsTable.content,
        status: interactionRecordsTable.status,
        channel: interactionRecordsTable.channel,
        agentName: interactionRecordsTable.agentName,
        durationSeconds: interactionRecordsTable.durationSeconds,
        resolution: interactionRecordsTable.resolution,
        analysisRequested: interactionRecordsTable.analysisRequested,
        isCustomerRequest: interactionRecordsTable.isCustomerRequest,
        relevanceReason: interactionRecordsTable.relevanceReason,
        excludedFromAnalysis: interactionRecordsTable.excludedFromAnalysis,
        exclusionReason: interactionRecordsTable.exclusionReason,
        company: customersTable.company,
        interactedAt: interactionRecordsTable.interactedAt,
        createdAt: interactionRecordsTable.createdAt,
      })
      .from(interactionRecordsTable)
      .leftJoin(customersTable, eq(interactionRecordsTable.customerId, customersTable.id))
      .orderBy(desc(interactionRecordsTable.interactedAt));

    const rows = customerId
      ? await query.where(eq(interactionRecordsTable.customerId, customerId))
      : await query;

    res.json(rows.map(r => ({
      ...r,
      interactedAt: r.interactedAt?.toISOString(),
      createdAt: r.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── CREATE SINGLE ───────────────────────────────────────────────────────────
router.post("/interaction-records", async (req, res) => {
  try {
    const { customerId, type, subject, content, status, channel, agentName, durationSeconds, resolution, interactedAt } = req.body;
    if (!customerId || !type || !subject || !content) {
      return res.status(400).json({ error: "customerId, type, subject ve content zorunludur." });
    }
    const [record] = await db.insert(interactionRecordsTable).values({
      customerId: Number(customerId),
      type,
      subject,
      content,
      status: status || "open",
      channel: channel || "email",
      agentName: agentName || null,
      durationSeconds: durationSeconds ? Number(durationSeconds) : null,
      resolution: resolution || null,
      interactedAt: interactedAt ? new Date(interactedAt) : new Date(),
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "CREATE_INTERACTION",
      entityType: "interaction_records",
      entityId: record.id,
      userId: "system",
      details: `${type} kaydı eklendi: ${subject} (Müşteri ID: ${customerId})`,
      piiMasked: false,
    });

    res.status(201).json({ ...record, interactedAt: record.interactedAt.toISOString(), createdAt: record.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── TOGGLE EXCLUSION ────────────────────────────────────────────────────────
router.patch("/interaction-records/:id/toggle-exclusion", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [current] = await db.select({ excluded: interactionRecordsTable.excludedFromAnalysis, customerId: interactionRecordsTable.customerId })
      .from(interactionRecordsTable).where(eq(interactionRecordsTable.id, id));
    if (!current) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const newVal = !current.excluded;
    const [updated] = await db.update(interactionRecordsTable)
      .set({
        excludedFromAnalysis: newVal,
        exclusionReason: newVal ? (reason ?? null) : null,
      })
      .where(eq(interactionRecordsTable.id, id))
      .returning();

    res.json({ ...updated, reanalysisTriggered: true, interactedAt: updated.interactedAt.toISOString(), createdAt: updated.createdAt.toISOString() });

    // Auto-set customer isExcluded: true if ALL their interactions are now excluded
    (async () => {
      try {
        const allRecs = await db
          .select({ excluded: interactionRecordsTable.excludedFromAnalysis })
          .from(interactionRecordsTable)
          .where(eq(interactionRecordsTable.customerId, current.customerId));
        const allExcluded = allRecs.length > 0 && allRecs.every(r => r.excluded);
        await db.update(customersTable)
          .set({ isExcluded: allExcluded })
          .where(eq(customersTable.id, current.customerId));
      } catch (e) { console.error("isExcluded sync failed:", e); }
    })();

    // Fire-and-forget re-analysis so anomaly report reflects updated exclusion
    analyzeCustomer(current.customerId).catch(e =>
      console.error(`Re-analysis failed for customer ${current.customerId}:`, e)
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── COMPANY-LEVEL BULK EXCLUSION ────────────────────────────────────────────
router.post("/interaction-records/company-exclude", async (req, res) => {
  try {
    const { company, reason, exclude } = req.body as { company: string; reason: string; exclude: boolean };
    if (!company) return res.status(400).json({ error: "Firma adı gerekli" });

    // Find customer IDs for this company using ORM
    const companyCustomers = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.company, company));

    const customerIds = companyCustomers.map(r => r.id);
    if (customerIds.length === 0) return res.json({ updated: 0 });

    // Bulk update using inArray ORM operator
    const updated = await db
      .update(interactionRecordsTable)
      .set({
        excludedFromAnalysis: exclude,
        exclusionReason: exclude ? (reason || null) : null,
      })
      .where(inArray(interactionRecordsTable.customerId, customerIds))
      .returning({ id: interactionRecordsTable.id });

    res.json({ updated: updated.length, company, customerIds, reanalysisTriggered: true });

    // Sync isExcluded for all affected customers
    (async () => {
      for (const cid of customerIds) {
        try {
          const allRecs = await db
            .select({ excluded: interactionRecordsTable.excludedFromAnalysis })
            .from(interactionRecordsTable)
            .where(eq(interactionRecordsTable.customerId, cid));
          const allExcluded = allRecs.length > 0 && allRecs.every(r => r.excluded);
          await db.update(customersTable).set({ isExcluded: allExcluded }).where(eq(customersTable.id, cid));
        } catch (e) { console.error(`isExcluded sync failed for ${cid}:`, e); }
      }
    })();

    // Fire-and-forget re-analysis for all affected customers
    (async () => {
      for (const cid of customerIds) {
        try {
          await analyzeCustomer(cid);
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {
          console.error(`Re-analysis failed for customer ${cid}:`, e);
        }
      }
    })();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── BULK RELEVANCE CLASSIFY (Gemini) ────────────────────────────────────────
router.post("/interaction-records/classify-relevance", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };

    // Fetch the interactions to classify (all unclassified, or specific ids)
    const records = ids && ids.length > 0
      ? await db.select({ id: interactionRecordsTable.id, subject: interactionRecordsTable.subject, content: interactionRecordsTable.content, channel: interactionRecordsTable.channel, type: interactionRecordsTable.type })
          .from(interactionRecordsTable)
          .where(inArray(interactionRecordsTable.id, ids))
      : await db.select({ id: interactionRecordsTable.id, subject: interactionRecordsTable.subject, content: interactionRecordsTable.content, channel: interactionRecordsTable.channel, type: interactionRecordsTable.type })
          .from(interactionRecordsTable)
          .where(isNull(interactionRecordsTable.isCustomerRequest));

    if (records.length === 0) {
      return res.json({ classified: 0, results: [] });
    }

    // Fetch previously manually excluded records as few-shot learning examples
    const excludedExamples = await db.execute(
      sql`SELECT subject, content, exclusion_reason
          FROM interaction_records
          WHERE excluded_from_analysis = true
            AND exclusion_reason IS NOT NULL
            AND exclusion_reason != ''
          LIMIT 15`
    );
    const learnedExclusions = excludedExamples.rows as Array<{ subject: string; content: string; exclusion_reason: string }>;

    // Build prompt with all records (limit 50 at a time to avoid token overflow)
    const batch = records.slice(0, 50);

    const learnedSection = learnedExclusions.length > 0
      ? `\nKULLANICI TARAFINDAN DAHA ÖNCE HARİÇ TUTULAN ÖRNEKLER (bu kalıplara benzer kayıtları da hariç tut):\n${
          learnedExclusions.map(ex => `- Konu: "${ex.subject.slice(0, 80)}" → Sebep: "${ex.exclusion_reason}"`).join("\n")
        }\n`
      : "";

    const prompt = `Sen bir B2B SaaS müşteri destek sistemi analistissin. Aşağıdaki etkileşim kayıtlarını analiz et ve her birinin GERÇEK BİR MÜŞTERİ TALEBİ mi yoksa ALAKASIZ İÇERİK mi olduğunu belirle.

GERÇEK MÜŞTERİ TALEBİ örnekleri:
- Teknik destek soruları, bug raporları, özellik istekleri
- Hesap sorunları, entegrasyon problemleri
- Fatura sorgulamaları (müşterinin gönderdiği, sistemin ürettiği değil)
- Kullanım kılavuzu soruları, konfigürasyon yardımı

ALAKASIZ İÇERİK örnekleri:
- Otomatik faturalandırma e-postaları (ödeme makbuzları, fatura bildirimleri)
- Tanıtım ve reklam e-postaları, bültenler
- Sistem bildirimleri (otomatik e-postalar, no-reply gönderenleri)
- Ürün duyuruları, pazarlama kampanyaları
- İç sistem notification'ları
${learnedSection}
Aşağıdaki kayıtlar için karar ver:
${batch.map((r, i) => `
[ID:${r.id}]
Kanal: ${r.channel} | Tür: ${r.type}
Konu: ${r.subject}
İçerik (ilk 300 karakter): ${r.content.slice(0, 300).replace(/\n/g, " ")}
`).join("\n---\n")}

Yanıtını SADECE aşağıdaki JSON formatında döndür:
{
  "results": [
    {
      "id": 123,
      "isCustomerRequest": true,
      "reason": "Kısa Türkçe açıklama (max 15 kelime)"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: { results: Array<{ id: number; isCustomerRequest: boolean; reason: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Gemini geçersiz JSON döndürdü" });
    }

    // Save classification results to DB
    await Promise.all(
      (parsed.results ?? []).map(async (r) => {
        await db.update(interactionRecordsTable)
          .set({
            isCustomerRequest: r.isCustomerRequest,
            relevanceReason: r.reason,
            excludedFromAnalysis: !r.isCustomerRequest,
          })
          .where(eq(interactionRecordsTable.id, r.id));
      })
    );

    res.json({ classified: parsed.results?.length ?? 0, results: parsed.results ?? [] });
  } catch (err) {
    console.error("classify-relevance error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────
router.delete("/interaction-records/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(interactionRecordsTable).where(eq(interactionRecordsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── TEMPLATE ROWS (shared) ──────────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  "customer_email", "type", "subject", "content",
  "status", "channel", "agent_name", "duration_seconds", "resolution", "interacted_at",
];
const TEMPLATE_ROWS = [
  ["ahmet.yilmaz@sirket.com", "ticket", "Fatura Hatası", "Geçen ay fazladan fatura kesildi. Hesap ekstremi incelediğimde XX TL fazla tahsilat gördüm.", "open", "email", "Zeynep K.", "", "", "2026-03-10T09:00:00"],
  ["zeynep.kaya@firma.com", "chat", "Ürün iade talebi", "Aldığım ürün hasarlı geldi müşteri destek hattını aradım ancak yanıt alamadım.", "resolved", "chat", "Can D.", "", "Ürün değiştirildi", "2026-03-11T14:30:00"],
  ["can.demir@startup.io", "call", "Servis şikayeti", "Teknik destek için 3 kez aradım her seferinde bekleme süresi 20 dakikayı aştı.", "escalated", "phone", "Mehmet A.", "1320", "Üst yönetime iletildi", "2026-03-12T11:15:00"],
];

// ─── CSV TEMPLATE ────────────────────────────────────────────────────────────
router.get("/interaction-records/template", (_req, res) => {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=etkilesim_sablonu.csv");
  res.send("\uFEFF" + rows);
});

// ─── XLSX TEMPLATE ───────────────────────────────────────────────────────────
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

// ─── BULK IMPORT ─────────────────────────────────────────────────────────────
const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

function isExcel(file: Express.Multer.File) {
  if (XLSX_MIME.has(file.mimetype)) return true;
  const name = file.originalname.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

router.post("/interaction-records/bulk", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi." });

  let records: Record<string, string>[];
  try {
    if (isExcel(req.file)) {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false, raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Use first row as headers, preserving original column names (Turkish)
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) return res.status(400).json({ error: "Excel dosyası boş veya başlık satırı eksik." });
      records = raw.map(row => {
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

  // ── Detect Infoset "Talep Detay Raporu" format ──────────────────────────
  const firstRowKeys = Object.keys(records[0]);
  const isInfoset = firstRowKeys.includes("Kişi E-postası") || firstRowKeys.includes("Konu");

  // ── Turkish date parser: "27 Şub 2026 16:45" → Date ────────────────────
  const TR_MONTHS: Record<string, string> = {
    "Oca": "Jan", "Şub": "Feb", "Mar": "Mar", "Nis": "Apr",
    "May": "May", "Haz": "Jun", "Tem": "Jul", "Ağu": "Aug",
    "Eyl": "Sep", "Eki": "Oct", "Kas": "Nov", "Ara": "Dec",
  };
  function parseTrDate(raw: string): Date | null {
    if (!raw || raw === "-") return null;
    const replaced = raw.replace(/([A-ZÇĞİÖŞÜa-zçğışöşü]{3})/g, m => TR_MONTHS[m] ?? m);
    const d = new Date(replaced);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Map Infoset row to standard fields ──────────────────────────────────
  function mapInfosetRow(row: Record<string, string>) {
    const get = (k: string) => (row[k] ?? "").trim();

    // channel + type
    const kaynak = get("Kaynak");
    let channel = "email";
    let type: "ticket" | "chat" | "call" = "ticket";
    if (kaynak === "Çağrı") { channel = "phone"; type = "call"; }
    else if (kaynak === "E-posta") channel = "email";
    else if (kaynak === "WhatsApp" || kaynak === "Canlı Sohbet") { channel = "chat"; type = "chat"; }
    else if (kaynak === "Manuel") channel = "email";
    else if (kaynak) channel = kaynak.toLowerCase();

    // status
    const durumRaw = get("Durum");
    const statusMap: Record<string, string> = { "Açık": "open", "Çözüldü": "resolved", "Beklemede": "open", "İptal": "closed" };
    const status = statusMap[durumRaw] ?? "open";

    // agent — first name before comma
    const agentRaw = get("Atananlar");
    const agentName = agentRaw ? agentRaw.split(",")[0].trim() : null;

    // resolution — combine closing date + closing note if available
    const closedAt = get("Kapanma Tarihi");
    const resolution = status === "resolved" && closedAt && closedAt !== "-"
      ? `Kapanma: ${closedAt}`
      : null;

    // duration — use "Çözüm Süresi (sn)" if present
    const durationRaw = get("Çözüm Süresi (sn)");
    const durationSeconds = durationRaw && durationRaw !== "-" && !isNaN(Number(durationRaw))
      ? Number(durationRaw) : null;

    // enrich content with categories
    let content = get("Açıklama");
    const kategori = get("Kategoriler") || get("İnfoset - Ana Kategori");
    const altKategori = get("İnfoset - Alt Kategori");
    const konu2 = get("İnfoset - Alt Kategori Talep Konusu");
    const urun = get("Ürün / Modül");
    const parts: string[] = [];
    if (kategori) parts.push(`Kategori: ${kategori}`);
    if (altKategori) parts.push(`Alt Kategori: ${altKategori}`);
    if (konu2) parts.push(`Konu: ${konu2}`);
    if (urun) parts.push(`Ürün/Modül: ${urun}`);
    if (parts.length && content) content = content + "\n\n[" + parts.join(" | ") + "]";
    else if (parts.length) content = "[" + parts.join(" | ") + "]";

    return {
      email: get("Kişi E-postası").toLowerCase(),
      name: get("Kişi") || get("Kişi E-postası"),
      company: get("Şirket"),
      subject: get("Konu"),
      content: content || get("Konu"),
      type,
      status,
      channel,
      agentName,
      durationSeconds,
      resolution,
      interactedAt: parseTrDate(get("Oluşturma Tarihi")) ?? new Date(),
    };
  }

  // ── Standard row mapper ──────────────────────────────────────────────────
  function getField(row: Record<string, string>, ...keys: string[]) {
    for (const k of keys) {
      const v = (row[k] || "").trim();
      if (v) return v;
    }
    return "";
  }
  function mapStandardRow(row: Record<string, string>) {
    const email = getField(row, "customer_email", "email", "müşteri_email").toLowerCase();
    const type = getField(row, "type", "tür").toLowerCase() as "ticket" | "chat" | "call";
    const subject = getField(row, "subject", "konu");
    const content = getField(row, "content", "içerik");
    const rawStatus = getField(row, "status", "durum").toLowerCase();
    const status = ["open", "resolved", "escalated", "closed"].includes(rawStatus) ? rawStatus : "open";
    const channel = getField(row, "channel", "kanal") || "email";
    const agentName = getField(row, "agent_name", "temsilci") || null;
    const durationRaw = getField(row, "duration_seconds", "süre");
    const durationSeconds = durationRaw ? Number(durationRaw) : null;
    const resolution = getField(row, "resolution", "çözüm") || null;
    const interactedAtRaw = getField(row, "interacted_at", "tarih");
    const interactedAt = interactedAtRaw ? new Date(interactedAtRaw) : new Date();
    return { email, name: "", company: "", subject, content, type, status, channel, agentName, durationSeconds, resolution, interactedAt };
  }

  // ── Build email→id lookup + optionally auto-create customers ─────────────
  const allCustomers = await db.select({ id: customersTable.id, email: customersTable.email }).from(customersTable);
  const emailToId: Record<string, number> = {};
  for (const c of allCustomers) emailToId[c.email.toLowerCase()] = c.id;

  let imported = 0;
  let skipped = 0;
  let customersCreated = 0;
  const errors: string[] = [];
  const importedCustomerIds = new Set<number>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    const mapped = isInfoset ? mapInfosetRow(row) : mapStandardRow(row);
    const { email, name, company, subject, content, type, status, channel, agentName, durationSeconds, resolution, interactedAt } = mapped;

    if (!email) { errors.push(`Satır ${rowNum}: E-posta adresi boş.`); skipped++; continue; }
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
          const [newCustomer] = await db.insert(customersTable).values({
            name: name.trim(),
            email,
            company: company ? company.trim() : null,
            segment: company ? company.trim().substring(0, 50) : "Genel",
          }).returning({ id: customersTable.id });
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
      await db.execute(sql`UPDATE customers SET company = ${company.trim()} WHERE id = ${customerId} AND (company IS NULL OR company = '')`);
    }

    if (interactedAt && isNaN(interactedAt.getTime())) {
      errors.push(`Satır ${rowNum}: Geçersiz tarih formatı.`);
      skipped++; continue;
    }

    try {
      await db.insert(interactionRecordsTable).values({
        customerId,
        type: (["ticket", "chat", "call"].includes(type) ? type : "ticket") as any,
        subject,
        content: content || subject,
        status: status as any,
        channel,
        agentName,
        durationSeconds,
        resolution,
        interactedAt,
      });
      importedCustomerIds.add(customerId);
      imported++;
    } catch (e: any) {
      errors.push(`Satır ${rowNum}: DB hatası — ${e.message}`);
      skipped++;
    }
  }

  await db.insert(auditLogsTable).values({
    action: "BULK_IMPORT_INTERACTIONS",
    entityType: "interaction_records",
    entityId: null,
    userId: "system",
    details: `Toplu etkileşim içe aktarma: ${imported} kayıt eklendi, ${skipped} atlandı, ${customersCreated} yeni müşteri oluşturuldu. Dosya: ${req.file.originalname}`,
    piiMasked: false,
  });

  res.json({ total: records.length, imported, skipped, customersCreated, importedCustomerIds: [...importedCustomerIds], errors: errors.slice(0, 30) });
});

export default router;
