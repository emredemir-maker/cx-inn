import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

router.post("/nlp/query", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Soru boş olamaz." });
    }

    // ── Gather comprehensive DB context ────────────────────────────────────────

    const [
      customerStats,
      topPainPoints,
      topKeyTopics,
      segmentStats,
      channelStats,
      churnStats,
      sentimentStats,
      openTickets,
      highRiskCustomers,
      npsDistribution,
    ] = await Promise.all([
      // Customer & analysis overview
      db.execute<{ total: string; analyzed: string; avg_nps: string; avg_csat: string }>(sql`
        SELECT
          COUNT(DISTINCT c.id)::text AS total,
          COUNT(DISTINCT ca.customer_id)::text AS analyzed,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps,
          ROUND(AVG(ca.predicted_csat)::numeric, 1)::text AS avg_csat
        FROM customers c
        LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
      `),

      // Top pain points with NPS impact
      db.execute<{ pain_point: string; customer_count: string; avg_nps: string }>(sql`
        SELECT
          unnest(ca.pain_points) AS pain_point,
          COUNT(DISTINCT ca.customer_id)::text AS customer_count,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps
        FROM cx_analyses ca
        WHERE ca.pain_points IS NOT NULL AND array_length(ca.pain_points, 1) > 0
        GROUP BY pain_point
        ORDER BY customer_count DESC
        LIMIT 20
      `),

      // Top key topics
      db.execute<{ topic: string; customer_count: string; avg_nps: string }>(sql`
        SELECT
          unnest(ca.key_topics) AS topic,
          COUNT(DISTINCT ca.customer_id)::text AS customer_count,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps
        FROM cx_analyses ca
        WHERE ca.key_topics IS NOT NULL AND array_length(ca.key_topics, 1) > 0
        GROUP BY topic
        ORDER BY customer_count DESC
        LIMIT 20
      `),

      // Segment distribution
      db.execute<{ segment: string; customer_count: string; avg_nps: string; high_churn: string }>(sql`
        SELECT
          COALESCE(c.segment, 'Genel') AS segment,
          COUNT(*)::text AS customer_count,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps,
          SUM(CASE WHEN c.churn_risk = 'high' THEN 1 ELSE 0 END)::text AS high_churn
        FROM customers c
        LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
        GROUP BY segment
        ORDER BY customer_count DESC
        LIMIT 15
      `),

      // Channel performance
      db.execute<{ channel: string; ticket_count: string; avg_nps: string; open_count: string }>(sql`
        SELECT
          ir.channel,
          COUNT(ir.id)::text AS ticket_count,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps,
          SUM(CASE WHEN ir.status = 'open' THEN 1 ELSE 0 END)::text AS open_count
        FROM interaction_records ir
        LEFT JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
        WHERE NOT COALESCE(ir.excluded_from_analysis, false)
        GROUP BY ir.channel
        ORDER BY ticket_count DESC
      `),

      // Churn risk distribution
      db.execute<{ churn_risk: string; count: string; avg_nps: string }>(sql`
        SELECT
          c.churn_risk,
          COUNT(*)::text AS count,
          ROUND(AVG(ca.predicted_nps)::numeric, 1)::text AS avg_nps
        FROM customers c
        LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
        GROUP BY c.churn_risk
        ORDER BY count DESC
      `),

      // Sentiment distribution
      db.execute<{ sentiment: string; count: string }>(sql`
        SELECT overall_sentiment AS sentiment, COUNT(DISTINCT customer_id)::text AS count
        FROM cx_analyses
        GROUP BY overall_sentiment
      `),

      // Open tickets by type
      db.execute<{ type: string; count: string }>(sql`
        SELECT type, COUNT(*)::text AS count
        FROM interaction_records
        WHERE status = 'open' AND NOT COALESCE(excluded_from_analysis, false)
        GROUP BY type
        ORDER BY count DESC
      `),

      // High risk customers (top 10)
      db.execute<{ name: string; company: string; churn_risk: string; nps: string; pain: string }>(sql`
        SELECT
          c.name,
          COALESCE(c.company, c.segment, 'Bilinmiyor') AS company,
          c.churn_risk,
          ROUND(ca.predicted_nps::numeric, 1)::text AS nps,
          (ca.pain_points[1]) AS pain
        FROM customers c
        LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
        WHERE c.churn_risk = 'high' AND ca.id IS NOT NULL
        ORDER BY ca.predicted_nps ASC NULLS LAST
        LIMIT 10
      `),

      // NPS distribution bands
      db.execute<{ band: string; count: string }>(sql`
        SELECT
          CASE
            WHEN predicted_nps >= 9 THEN 'Promoter (9-10)'
            WHEN predicted_nps >= 7 THEN 'Passive (7-8)'
            ELSE 'Detractor (0-6)'
          END AS band,
          COUNT(DISTINCT customer_id)::text AS count
        FROM cx_analyses
        WHERE predicted_nps IS NOT NULL
        GROUP BY band
        ORDER BY count DESC
      `),
    ]);

    // ── Build context string ───────────────────────────────────────────────────
    const overview = customerStats.rows[0];

    const ctx = `
GENEL PLATFORM VERİLERİ:
- Toplam müşteri: ${overview?.total ?? 0}
- AI analizi yapılan: ${overview?.analyzed ?? 0}
- Ortalama tahmin NPS: ${overview?.avg_nps ?? "—"} /10
- Ortalama tahmin CSAT: ${overview?.avg_csat ?? "—"} /5

NPS DAĞILIMI:
${npsDistribution.rows.map(r => `- ${r.band}: ${r.count} müşteri`).join("\n")}

CHURN RİSKİ DAĞILIMI:
${churnStats.rows.map(r => `- ${r.churn_risk === "high" ? "Yüksek" : r.churn_risk === "medium" ? "Orta" : "Düşük"} risk: ${r.count} müşteri (ort. NPS: ${r.avg_nps ?? "—"})`).join("\n")}

DUYGU DURUMU DAĞILIMI:
${sentimentStats.rows.map(r => `- ${r.sentiment}: ${r.count} müşteri`).join("\n")}

AÇIK TALEPLERİN TÜRE GÖRE DAĞILIMI:
${openTickets.rows.map(r => `- ${r.type}: ${r.count} açık talep`).join("\n")}

EN YOĞUN ACİ NOKTALAR (pain points, NPS etkisiyle):
${topPainPoints.rows.map(r => `- "${r.pain_point}" — ${r.customer_count} müşteri, ort. NPS: ${r.avg_nps}`).join("\n")}

EN SIK ANAHTAR KONULAR:
${topKeyTopics.rows.map(r => `- "${r.topic}" — ${r.customer_count} müşteri, ort. NPS: ${r.avg_nps}`).join("\n")}

SEGMENT BAZLI ANALİZ:
${segmentStats.rows.map(r => `- ${r.segment}: ${r.customer_count} müşteri, ort. NPS: ${r.avg_nps ?? "—"}, yüksek churn: ${r.high_churn}`).join("\n")}

KANAL PERFORMANSI:
${channelStats.rows.map(r => `- ${r.channel}: ${r.ticket_count} kayıt, ort. NPS: ${r.avg_nps ?? "—"}, açık: ${r.open_count}`).join("\n")}

YÜKSEK RİSKLİ MÜŞTERİLER (top 10):
${highRiskCustomers.rows.map(r => `- ${r.name} (${r.company}) — NPS: ${r.nps ?? "—"}, Sorun: ${r.pain ?? "Bilinmiyor"}`).join("\n")}
`.trim();

    // ── Ask Gemini ─────────────────────────────────────────────────────────────
    const prompt = `Sen bir B2B müşteri deneyimi (CX) analisti yapay zekasısın. Aşağıda gerçek CX platform veritabanından çekilen veriler bulunuyor.

${ctx}

KULLANICI SORUSU: ${question.trim()}

TALİMAT: Yanıtı kısa, net ve taranabilir biçimde ver. Uzun paragraflar YOK.

YANIT FORMATI (kesinlikle geçerli JSON döndür, başka hiçbir şey yazma):
{
  "answer": "<1-2 cümle özet. Somut rakam içersin. Maksimum 30 kelime.>",
  "highlights": ["<🔴/🟡/🟢 emoji + kısa kritik stat, maks 12 kelime>", "<...>", "<...>"],
  "type": "list" | "table",
  "listData": ["<🔸 başlık: açıklama, maks 15 kelime>", "<🔸 başlık: açıklama>", "..."],
  "tableData": [{"Sütun1": "Değer", "Sütun2": "Değer"}]
}

KURALLAR:
- answer: 1-2 cümle, maks 30 kelime, rakam/yüzde içersin
- highlights: 3-4 madde, her biri emoji ile başlasın, maks 12 kelime
- type her zaman "list" ya da "table" olsun (hiçbir zaman "text" değil)
- listData: 4-7 madde, her biri "🔸 Konu: Kısa açıklama" formatında, maks 15 kelime
- Tablo istenen sorularda type="table" kullan, listData boş dizi olsun
- Liste sorularında type="list", tableData boş dizi olsun
- Sadece JSON döndür, markdown code block kullanma`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
    });

    const rawText = response.text?.trim() ?? "";

    let parsed: any = {};
    // Robust JSON extraction: try multiple strategies
    const strategies = [
      () => JSON.parse(rawText),
      () => { const m = rawText.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("no match"); },
      () => { const s = rawText.replace(/```(?:json)?/gi, "").trim(); const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("no match"); },
      () => {
        // Handle case where thinking content precedes the JSON
        const lastBrace = rawText.lastIndexOf("{");
        const lastClose = rawText.lastIndexOf("}");
        if (lastBrace >= 0 && lastClose > lastBrace) {
          return JSON.parse(rawText.slice(lastBrace, lastClose + 1));
        }
        throw new Error("no braces");
      },
    ];

    for (const strategy of strategies) {
      try { parsed = strategy(); break; } catch { continue; }
    }

    if (!parsed.answer) {
      parsed = { answer: rawText || "Yanıt alınamadı.", highlights: [], type: "text", tableData: [], listData: [] };
    }

    res.json({
      question: question.trim(),
      answer: parsed.answer ?? "Yanıt oluşturulamadı.",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      type: ["text", "table", "list"].includes(parsed.type) ? parsed.type : "text",
      tableData: Array.isArray(parsed.tableData) ? parsed.tableData : [],
      listData: Array.isArray(parsed.listData) ? parsed.listData : [],
    });
  } catch (err) {
    console.error("NLP query error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
