import { Router } from "express";
import { db } from "@workspace/db";
import { interactionRecordsTable } from "@workspace/db/schema";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../../middleware/requireRole";
import { sanitizeError } from "../../lib/sanitize-error";

const router = Router();

// ─── BULK RELEVANCE CLASSIFY (Gemini) ────────────────────────────────────────
router.post("/interaction-records/classify-relevance", requireAuth, async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };

    // Fetch interactions to classify (specific IDs, or all unclassified)
    const records =
      ids && ids.length > 0
        ? await db
            .select({
              id: interactionRecordsTable.id,
              subject: interactionRecordsTable.subject,
              content: interactionRecordsTable.content,
              channel: interactionRecordsTable.channel,
              type: interactionRecordsTable.type,
            })
            .from(interactionRecordsTable)
            .where(inArray(interactionRecordsTable.id, ids))
        : await db
            .select({
              id: interactionRecordsTable.id,
              subject: interactionRecordsTable.subject,
              content: interactionRecordsTable.content,
              channel: interactionRecordsTable.channel,
              type: interactionRecordsTable.type,
            })
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
          LIMIT 15`,
    );
    const learnedExclusions = excludedExamples.rows as Array<{
      subject: string;
      content: string;
      exclusion_reason: string;
    }>;

    // Process up to 50 records per call to avoid token overflow
    const batch = records.slice(0, 50);

    const learnedSection =
      learnedExclusions.length > 0
        ? `\nKULLANICI TARAFINDAN DAHA ÖNCE HARİÇ TUTULAN ÖRNEKLER (bu kalıplara benzer kayıtları da hariç tut):\n${learnedExclusions
            .map((ex) => `- Konu: "${ex.subject.slice(0, 80)}" → Sebep: "${ex.exclusion_reason}"`)
            .join("\n")}\n`
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
${batch
  .map(
    (r) => `
[ID:${r.id}]
Kanal: ${r.channel} | Tür: ${r.type}
Konu: ${r.subject}
İçerik (ilk 300 karakter): ${r.content.slice(0, 300).replace(/\n/g, " ")}
`,
  )
  .join("\n---\n")}

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

    // Persist classification results
    await Promise.all(
      (parsed.results ?? []).map(async (r) => {
        await db
          .update(interactionRecordsTable)
          .set({
            isCustomerRequest: r.isCustomerRequest,
            relevanceReason: r.reason,
            excludedFromAnalysis: !r.isCustomerRequest,
          })
          .where(eq(interactionRecordsTable.id, r.id));
      }),
    );

    res.json({ classified: parsed.results?.length ?? 0, results: parsed.results ?? [] });
  } catch (err) {
    console.error("classify-relevance error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
