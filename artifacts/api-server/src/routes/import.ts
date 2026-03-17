import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { db } from "@workspace/db";
import { customersTable, auditLogsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function maskPii(text: string): string {
  return text.replace(/[a-zA-ZğüşıöçĞÜŞİÖÇ]+/g, (m, i, s) => {
    if (i === 0) return m.charAt(0) + "*".repeat(Math.max(m.length - 2, 1)) + (m.length > 1 ? m.charAt(m.length - 1) : "");
    return m;
  });
}

function normalizeRow(raw: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = (raw[k] || raw[k.toLowerCase()] || raw[k.toUpperCase()] || "").trim();
      if (v) return v;
    }
    return "";
  };

  const sentimentRaw = get("sentiment", "Sentiment", "duygu").toLowerCase();
  const sentiment = ["positive", "neutral", "negative"].includes(sentimentRaw)
    ? (sentimentRaw as "positive" | "neutral" | "negative")
    : "neutral";

  const churnRaw = get("churn_risk", "churnRisk", "Churn Risk", "kayip_riski").toLowerCase();
  const churnRisk = ["low", "medium", "high"].includes(churnRaw)
    ? (churnRaw as "low" | "medium" | "high")
    : "low";

  const npsRaw = parseFloat(get("nps_score", "npsScore", "NPS", "nps"));
  const npsScore = isNaN(npsRaw) ? null : Math.min(10, Math.max(0, npsRaw));

  return {
    name: get("name", "isim", "ad"),
    email: get("email", "e-posta", "eposta"),
    segment: get("segment", "Segment") || "Genel",
    npsScore,
    sentiment,
    churnRisk,
    lastInteraction: new Date(),
  };
}

router.post("/import/customers", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Dosya yüklenmedi." });
  }

  const mime = req.file.mimetype;
  const isXlsx = mime.includes("spreadsheet") || mime.includes("excel") || req.file.originalname.endsWith(".xlsx");
  if (isXlsx) {
    return res.status(400).json({ error: "Excel formatı şu an desteklenmiyor. Lütfen CSV olarak kaydedin." });
  }

  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (e: any) {
    return res.status(400).json({ error: "CSV ayrıştırma hatası: " + e.message });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: "CSV dosyası boş veya başlık satırı eksik." });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = normalizeRow(records[i]);

    if (!row.name || !row.email) {
      errors.push(`Satır ${i + 2}: "name" ve "email" alanları zorunludur.`);
      skipped++;
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(`Satır ${i + 2}: Geçersiz e-posta formatı — ${row.email}`);
      skipped++;
      continue;
    }

    try {
      await db
        .insert(customersTable)
        .values(row)
        .onConflictDoUpdate({
          target: customersTable.email,
          set: {
            name: row.name,
            segment: row.segment,
            npsScore: row.npsScore,
            sentiment: row.sentiment,
            churnRisk: row.churnRisk,
            lastInteraction: row.lastInteraction,
          },
        });
      imported++;
    } catch (e: any) {
      errors.push(`Satır ${i + 2}: DB hatası — ${e.message}`);
      skipped++;
    }
  }

  await db.insert(auditLogsTable).values({
    action: "DATA_IMPORT",
    entityType: "customers",
    entityId: null,
    userId: "system",
    details: `CSV içe aktarma: ${imported} kayıt eklendi/güncellendi, ${skipped} atlandı. Dosya: ${req.file.originalname}`,
    piiMasked: true,
  });

  res.json({
    total: records.length,
    imported,
    skipped,
    errors: errors.slice(0, 20),
  });
});

router.get("/import/template", (_req, res) => {
  const csv = [
    "name,email,segment,nps_score,sentiment,churn_risk",
    "Ahmet Yılmaz,ahmet.yilmaz@sirket.com,Kurumsal,8,positive,low",
    "Zeynep Kaya,zeynep.kaya@firma.com,KOBİ,5,neutral,medium",
    "Can Demir,can.demir@startup.io,Bireysel,2,negative,high",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=musteri_sablonu.csv");
  res.send("\uFEFF" + csv);
});

export default router;
