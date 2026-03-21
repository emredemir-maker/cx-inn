import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eq, asc } from "drizzle-orm";
import {
  conversations as conversationsTable,
  messages as messagesTable,
} from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import crypto from "crypto";

const router: IRouter = Router();

// ── In-memory query cache ─────────────────────────────────────────────────────
// key = sha256(normalised_question + data_fingerprint)
// TTL = 10 min; invalidated automatically when fingerprint changes
const queryCache = new Map<string, { answer: string; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(question: string, fingerprint: string): string {
  return crypto
    .createHash("sha256")
    .update(`${question.toLowerCase().trim()}::${fingerprint}`)
    .digest("hex");
}

/** Quick fingerprint: changes whenever customers or analyses are added/removed */
async function getDataFingerprint(): Promise<string> {
  try {
    const r = await db.execute<{
      customers: string;
      analyses: string;
      interactions: string;
    }>(sql`
      SELECT
        COUNT(DISTINCT c.id)::text          AS customers,
        COUNT(DISTINCT ca.id)::text         AS analyses,
        COUNT(DISTINCT ir.id)::text         AS interactions
      FROM customers c
      LEFT JOIN cx_analyses       ca ON ca.customer_id = c.id
      LEFT JOIN interaction_records ir ON ir.customer_id = c.id
    `);
    const row = r.rows[0];
    return `${row?.customers ?? 0}-${row?.analyses ?? 0}-${row?.interactions ?? 0}`;
  } catch {
    return "unknown";
  }
}

/** Build comprehensive DB context string for system prompt */
async function buildContext(): Promise<string> {
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
    db.execute<{ total: string; analyzed: string; avg_nps: string; avg_csat: string }>(sql`
      SELECT
        COUNT(DISTINCT c.id)::text                       AS total,
        COUNT(DISTINCT ca.customer_id)::text             AS analyzed,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text  AS avg_nps,
        ROUND(AVG(ca.predicted_csat)::numeric, 1)::text AS avg_csat
      FROM customers c
      LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
    `),

    db.execute<{ pain_point: string; customer_count: string; avg_nps: string }>(sql`
      SELECT
        unnest(ca.pain_points)                            AS pain_point,
        COUNT(DISTINCT ca.customer_id)::text              AS customer_count,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text   AS avg_nps
      FROM cx_analyses ca
      WHERE ca.pain_points IS NOT NULL AND array_length(ca.pain_points, 1) > 0
      GROUP BY pain_point ORDER BY customer_count DESC LIMIT 20
    `),

    db.execute<{ topic: string; customer_count: string; avg_nps: string }>(sql`
      SELECT
        unnest(ca.key_topics)                             AS topic,
        COUNT(DISTINCT ca.customer_id)::text              AS customer_count,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text   AS avg_nps
      FROM cx_analyses ca
      WHERE ca.key_topics IS NOT NULL AND array_length(ca.key_topics, 1) > 0
      GROUP BY topic ORDER BY customer_count DESC LIMIT 20
    `),

    db.execute<{ segment: string; customer_count: string; avg_nps: string; high_churn: string }>(sql`
      SELECT
        COALESCE(c.segment, 'Genel')                      AS segment,
        COUNT(*)::text                                    AS customer_count,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text   AS avg_nps,
        SUM(CASE WHEN c.churn_risk = 'high' THEN 1 ELSE 0 END)::text AS high_churn
      FROM customers c
      LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
      GROUP BY segment ORDER BY customer_count DESC LIMIT 15
    `),

    db.execute<{ channel: string; ticket_count: string; avg_nps: string; open_count: string }>(sql`
      SELECT
        ir.channel,
        COUNT(ir.id)::text                                AS ticket_count,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text   AS avg_nps,
        SUM(CASE WHEN ir.status = 'open' THEN 1 ELSE 0 END)::text AS open_count
      FROM interaction_records ir
      LEFT JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
      WHERE NOT COALESCE(ir.excluded_from_analysis, false)
      GROUP BY ir.channel ORDER BY ticket_count DESC
    `),

    db.execute<{ churn_risk: string; count: string; avg_nps: string }>(sql`
      SELECT
        c.churn_risk,
        COUNT(*)::text                                    AS count,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text   AS avg_nps
      FROM customers c
      LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
      GROUP BY c.churn_risk ORDER BY count DESC
    `),

    db.execute<{ sentiment: string; count: string }>(sql`
      SELECT overall_sentiment AS sentiment,
             COUNT(DISTINCT customer_id)::text AS count
      FROM cx_analyses
      GROUP BY overall_sentiment
    `),

    db.execute<{ type: string; count: string }>(sql`
      SELECT type, COUNT(*)::text AS count
      FROM interaction_records
      WHERE status = 'open' AND NOT COALESCE(excluded_from_analysis, false)
      GROUP BY type ORDER BY count DESC
    `),

    db.execute<{ name: string; company: string; churn_risk: string; nps: string; pain: string }>(sql`
      SELECT
        c.name,
        COALESCE(c.company, c.segment, 'Bilinmiyor')     AS company,
        c.churn_risk,
        ROUND(ca.predicted_nps::numeric, 1)::text        AS nps,
        ca.pain_points[1]                                AS pain
      FROM customers c
      LEFT JOIN cx_analyses ca ON ca.customer_id = c.id
      WHERE c.churn_risk = 'high' AND ca.id IS NOT NULL
      ORDER BY ca.predicted_nps ASC NULLS LAST LIMIT 10
    `),

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
      GROUP BY band ORDER BY count DESC
    `),
  ]);

  const ov = customerStats.rows[0];
  return `
GENEL PLATFORM VERİLERİ:
- Toplam müşteri: ${ov?.total ?? 0}
- AI analizi yapılan: ${ov?.analyzed ?? 0}
- Ortalama tahmin NPS: ${ov?.avg_nps ?? "—"}/10
- Ortalama tahmin CSAT: ${ov?.avg_csat ?? "—"}/5

NPS DAĞILIMI:
${npsDistribution.rows.map(r => `- ${r.band}: ${r.count} müşteri`).join("\n") || "- Veri yok"}

CHURN RİSKİ:
${churnStats.rows.map(r => `- ${r.churn_risk === "high" ? "Yüksek" : r.churn_risk === "medium" ? "Orta" : "Düşük"} risk: ${r.count} müşteri (ort. NPS: ${r.avg_nps ?? "—"})`).join("\n") || "- Veri yok"}

DUYGU DURUMU:
${sentimentStats.rows.map(r => `- ${r.sentiment}: ${r.count} müşteri`).join("\n") || "- Veri yok"}

AÇIK TALEPLER:
${openTickets.rows.map(r => `- ${r.type}: ${r.count} açık`).join("\n") || "- Veri yok"}

EN YOĞUN ACİ NOKTALAR:
${topPainPoints.rows.map(r => `- "${r.pain_point}": ${r.customer_count} müşteri, ort. NPS ${r.avg_nps}`).join("\n") || "- Veri yok"}

EN SIK KONULAR:
${topKeyTopics.rows.map(r => `- "${r.topic}": ${r.customer_count} müşteri, ort. NPS ${r.avg_nps}`).join("\n") || "- Veri yok"}

SEGMENT ANALİZİ:
${segmentStats.rows.map(r => `- ${r.segment}: ${r.customer_count} müşteri, ort. NPS ${r.avg_nps ?? "—"}, yüksek churn: ${r.high_churn}`).join("\n") || "- Veri yok"}

KANAL PERFORMANSI:
${channelStats.rows.map(r => `- ${r.channel}: ${r.ticket_count} kayıt, ort. NPS ${r.avg_nps ?? "—"}, açık: ${r.open_count}`).join("\n") || "- Veri yok"}

YÜKSEK RİSKLİ MÜŞTERİLER (top 10):
${highRiskCustomers.rows.map(r => `- ${r.name} (${r.company}): NPS ${r.nps ?? "—"}, Sorun: ${r.pain ?? "Bilinmiyor"}`).join("\n") || "- Veri yok"}
`.trim();
}

// ── POST /api/nlp/conversation — start new CX conversation ───────────────────
router.post("/nlp/conversation", async (req, res) => {
  try {
    const ctx = await buildContext();

    const systemPrompt = `Sen bir B2B müşteri deneyimi (CX) analisti yapay zekasısın.
Aşağıda gerçek CX platformundan çekilen güncel veriler bulunuyor. Bu konuşma boyunca bu bağlamı hatırla, önceki sorulara atıf yapabilirsin ve birbiriyle ilişkili soruları anlayabilirsin.

${ctx}

YANIT KURALLARI:
- Her zaman Türkçe yanıt ver
- Somut rakamlar ve yüzdeler kullan
- Madde madde listeler ve başlıklar kullan (markdown destekleniyor)
- Önceki sorulara bağlam kurabilirsin ("az önce bahsettiğin...", "o müşterilere ek olarak..." gibi)
- Veri yoksa "henüz analiz verisi bulunmuyor" diyerek alternatif öner
- Yanıtları kısa tut, detay istenirse genişlet`;

    const [conversation] = await db
      .insert(conversationsTable)
      .values({ title: `CX Sorgu - ${new Date().toLocaleDateString("tr-TR")}` })
      .returning();

    // First two messages = hidden system context (not shown in UI)
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "user",
      content: systemPrompt,
    });
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      content:
        "Anladım. CX platform verilerini inceledim ve konuşmaya hazırım. Sorularınızı bekliyorum.",
    });

    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error("[NLP] conversation start error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/nlp/conversation/:id/message — SSE streaming message ────────────
router.post("/nlp/conversation/:id/message", async (req, res) => {
  const id = Number(req.params.id);
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Soru boş olamaz." });
  }

  const trimmed = question.trim();

  // Set SSE headers early so client can start reading
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // Check cache
    const fingerprint = await getDataFingerprint();
    const key = cacheKey(trimmed, fingerprint);
    const cached = queryCache.get(key);
    const now = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      // Save message pair to DB for conversation continuity
      await db.insert(messagesTable).values({ conversationId: id, role: "user", content: trimmed });

      // Stream cached answer word-by-word for smooth UX
      const words = cached.answer.split(/(\s+)/);
      for (const chunk of words) {
        if (chunk) {
          res.write(`data: ${JSON.stringify({ content: chunk, fromCache: true })}\n\n`);
          await new Promise((r) => setTimeout(r, 15));
        }
      }

      await db.insert(messagesTable).values({
        conversationId: id,
        role: "assistant",
        content: cached.answer,
      });

      res.write(`data: ${JSON.stringify({ done: true, fromCache: true })}\n\n`);
      res.end();
      return;
    }

    // Verify conversation exists
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      res.write(`data: ${JSON.stringify({ error: "Konuşma bulunamadı." })}\n\n`);
      res.end();
      return;
    }

    // Save user message
    await db.insert(messagesTable).values({ conversationId: id, role: "user", content: trimmed });

    // Load full history (including hidden system context)
    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.id));

    // Stream from Gemini
    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: allMessages.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: 8192,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // Persist assistant message
    await db.insert(messagesTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    // Cache result
    queryCache.set(key, { answer: fullResponse, ts: now });

    res.write(`data: ${JSON.stringify({ done: true, fromCache: false })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[NLP] message error:", err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

// ── GET /api/nlp/conversation/:id — history (excluding hidden system messages) ─
router.get("/nlp/conversation/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.id));

    // Skip first two messages (system prompt + ack)
    const userFacing = rows.slice(2).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    res.json({ messages: userFacing });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
