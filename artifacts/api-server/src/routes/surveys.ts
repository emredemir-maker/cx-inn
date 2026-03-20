import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable, auditLogsTable, surveyResponsesTable, surveyCampaignsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { CreateSurveyBody, UpdateSurveyBody, UpdateSurveyParams, GetSurveyParams, DeleteSurveyParams } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

// ─── AI DESIGN SUGGESTIONS ───────────────────────────────────────────────────
router.post("/surveys/ai-design-suggest", requireAuth, async (req, res) => {
  try {
    const { surveyType, companyName, industry, tone } = req.body as {
      surveyType: string;
      companyName?: string;
      industry?: string;
      tone?: string;
    };

    const prompt = `Sen bir B2B SaaS e-posta tasarım uzmanısın. Bir ${surveyType} müşteri memnuniyeti anketi için e-posta tasarım önerileri oluştur.

Şirket: ${companyName || "CX-Inn"}
${industry ? `Sektör: ${industry}` : ""}
${tone ? `Ton: ${tone}` : "Ton: Profesyonel ve samimi"}

Lütfen aşağıdaki JSON formatında tam olarak 3 farklı tasarım paketi döndür. Sadece geçerli JSON döndür, başka hiçbir şey ekleme:

{
  "suggestions": [
    {
      "name": "Paket adı (örn: 'Güven & Netlik')",
      "description": "Bu paketin tonu ve neden önerildiği hakkında 1-2 cümle",
      "brandColor": "#HEX renk kodu (canlı, marka rengi olarak uygun)",
      "bgColor": "#HEX koyu arkaplan rengi",
      "textColor": "#HEX açık metin rengi",
      "buttonStyle": "pill veya rounded veya square",
      "headline": "${surveyType} anketi için dikkat çekici, samimi Türkçe başlık (max 10 kelime)",
      "subheadline": "Motivasyon veren alt başlık, neden önemli olduğunu açıklayan (max 20 kelime)",
      "footerNote": "Kısa, nazik footer notu (max 15 kelime)"
    }
  ]
}

Paketler birbirinden belirgin şekilde farklı olsun:
1. Birinci: Kurumsal ve güven veren ton (mavi/lacivert tonları)
2. İkinci: Sıcak ve samimi ton (turuncu/amber tonları)
3. Üçüncü: Modern ve enerjik ton (mor/indigo veya yeşil tonları)`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.8 },
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI yanıtı JSON içermiyor");
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get("/surveys", requireAuth, async (_req, res) => {
  try {
    const surveys = await db.select().from(surveysTable).orderBy(surveysTable.createdAt);
    res.json(surveys.map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post("/surveys", requireAuth, async (req, res) => {
  try {
    const body = CreateSurveyBody.parse(req.body);
    const [survey] = await db.insert(surveysTable).values({
      title: body.title,
      type: body.type,
      channel: body.channel,
      triggerEvent: body.triggerEvent,
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "CREATE",
      entityType: "survey",
      entityId: survey.id,
      userId: "system",
      details: `Anket oluşturuldu: ${body.title}`,
      piiMasked: false,
    });

    res.status(201).json({
      ...survey,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
    });
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

router.get("/surveys/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetSurveyParams.parse({ id: Number(req.params.id) });
    const [survey] = await db.select().from(surveysTable).where(eq(surveysTable.id, id));
    if (!survey) return res.status(404).json({ error: "Bulunamadı" });
    res.json({ ...survey, createdAt: survey.createdAt.toISOString(), updatedAt: survey.updatedAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

router.patch("/surveys/:id", requireAuth, async (req, res) => {
  try {
    const { id } = UpdateSurveyParams.parse({ id: Number(req.params.id) });
    const body = UpdateSurveyBody.parse(req.body);
    const [survey] = await db.update(surveysTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(surveysTable.id, id))
      .returning();
    if (!survey) return res.status(404).json({ error: "Bulunamadı" });

    await db.insert(auditLogsTable).values({
      action: "UPDATE",
      entityType: "survey",
      entityId: id,
      userId: "system",
      details: `Anket güncellendi: ${id}`,
      piiMasked: false,
    });

    res.json({ ...survey, createdAt: survey.createdAt.toISOString(), updatedAt: survey.updatedAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

router.delete("/surveys/:id", requireAuth, async (req, res) => {
  try {
    const { id } = DeleteSurveyParams.parse({ id: Number(req.params.id) });
    await db.delete(surveysTable).where(eq(surveysTable.id, id));

    await db.insert(auditLogsTable).values({
      action: "DELETE",
      entityType: "survey",
      entityId: id,
      userId: "system",
      details: `Anket silindi: ${id}`,
      piiMasked: false,
    });

    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

// ─── SURVEY RESPONSES ─────────────────────────────────────────────────────────

// Record a new response
router.post("/survey-responses", async (req, res) => {
  try {
    const {
      surveyId, campaignId, customerId, score, feedback,
    } = req.body as {
      surveyId: number;
      campaignId?: number;
      customerId?: number;
      score: number;
      feedback?: string;
    };

    if (!surveyId || score === undefined || score === null) {
      return res.status(400).json({ error: "surveyId ve score zorunlu" });
    }

    // Determine sentiment from score
    const survey = await db.select().from(surveysTable).where(eq(surveysTable.id, surveyId)).limit(1);
    const surveyType = survey[0]?.type ?? "nps";

    let sentiment: "positive" | "neutral" | "negative";
    if (surveyType === "nps") {
      sentiment = score >= 9 ? "positive" : score >= 7 ? "neutral" : "negative";
    } else {
      // csat / ces: typically 1-5
      sentiment = score >= 4 ? "positive" : score >= 3 ? "neutral" : "negative";
    }

    const [response] = await db.insert(surveyResponsesTable).values({
      surveyId,
      campaignId: campaignId ?? null,
      customerId: customerId ?? null,
      score,
      feedback: feedback ?? null,
      sentiment,
      respondedAt: new Date(),
    }).returning();

    // Update campaign completed count
    if (campaignId) {
      await db.execute(sql`
        UPDATE survey_campaigns
        SET total_completed = total_completed + 1
        WHERE id = ${campaignId}
      `);
    }

    await db.insert(auditLogsTable).values({
      action: "CREATE",
      entityType: "survey_response",
      entityId: response.id,
      userId: customerId ? String(customerId) : "anonymous",
      details: `Anket yanıtı: surveyId=${surveyId}, score=${score}, sentiment=${sentiment}`,
      piiMasked: false,
    });

    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

// Get responses for a survey (with summary)
router.get("/survey-responses", requireAuth, async (req, res) => {
  try {
    const surveyId = req.query.surveyId ? parseInt(req.query.surveyId as string) : undefined;
    const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;

    const baseQuery = surveyId
      ? db.select().from(surveyResponsesTable).where(eq(surveyResponsesTable.surveyId, surveyId))
      : campaignId
      ? db.select().from(surveyResponsesTable).where(eq(surveyResponsesTable.campaignId, campaignId!))
      : db.select().from(surveyResponsesTable);

    const responses = await baseQuery.orderBy(desc(surveyResponsesTable.respondedAt));

    // Summary stats
    const scores = responses.map((r) => r.score);
    const avgScore = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    responses.forEach((r) => { sentimentCounts[r.sentiment as keyof typeof sentimentCounts]++; });

    res.json({
      responses: responses.map((r) => ({
        ...r,
        respondedAt: r.respondedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      summary: {
        total: responses.length,
        avgScore,
        sentimentCounts,
      },
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// Get response summary grouped by survey (for surveys list page)
router.get("/survey-responses/summary", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute<{
      survey_id: number;
      total: string;
      avg_score: string;
      positive: string;
      neutral: string;
      negative: string;
    }>(sql`
      SELECT
        survey_id,
        COUNT(*)::text as total,
        ROUND(AVG(score)::numeric, 1)::text as avg_score,
        COUNT(*) FILTER (WHERE sentiment = 'positive')::text as positive,
        COUNT(*) FILTER (WHERE sentiment = 'neutral')::text as neutral,
        COUNT(*) FILTER (WHERE sentiment = 'negative')::text as negative
      FROM survey_responses
      GROUP BY survey_id
    `);

    const summary: Record<number, { total: number; avgScore: number | null; positive: number; neutral: number; negative: number }> = {};
    rows.rows.forEach((r) => {
      summary[r.survey_id] = {
        total: parseInt(r.total),
        avgScore: r.avg_score ? parseFloat(r.avg_score) : null,
        positive: parseInt(r.positive),
        neutral: parseInt(r.neutral),
        negative: parseInt(r.negative),
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
