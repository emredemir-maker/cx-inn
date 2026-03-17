import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveyCampaignsTable, surveyResponsesTable, surveysTable, customersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordPredictionAccuracy } from "../lib/accuracy";

const router: IRouter = Router();

router.get("/survey-campaigns", async (_req, res) => {
  try {
    const campaigns = await db
      .select({
        id: surveyCampaignsTable.id,
        name: surveyCampaignsTable.name,
        description: surveyCampaignsTable.description,
        status: surveyCampaignsTable.status,
        channel: surveyCampaignsTable.channel,
        targetSegment: surveyCampaignsTable.targetSegment,
        totalTargeted: surveyCampaignsTable.totalTargeted,
        totalSent: surveyCampaignsTable.totalSent,
        totalCompleted: surveyCampaignsTable.totalCompleted,
        scheduledAt: surveyCampaignsTable.scheduledAt,
        createdAt: surveyCampaignsTable.createdAt,
        surveyId: surveyCampaignsTable.surveyId,
        surveyTitle: surveysTable.title,
        surveyType: surveysTable.type,
      })
      .from(surveyCampaignsTable)
      .leftJoin(surveysTable, eq(surveyCampaignsTable.surveyId, surveysTable.id))
      .orderBy(desc(surveyCampaignsTable.createdAt));

    res.json(campaigns.map(c => ({
      ...c,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      createdAt: c.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/survey-campaigns", async (req, res) => {
  try {
    const { surveyId, name, description, channel, targetSegment, totalTargeted, scheduledAt } = req.body;
    if (!surveyId || !name) return res.status(400).json({ error: "surveyId ve name zorunludur." });

    const [campaign] = await db.insert(surveyCampaignsTable).values({
      surveyId: Number(surveyId),
      name,
      description: description || null,
      channel: channel || "email",
      targetSegment: targetSegment || null,
      totalTargeted: Number(totalTargeted) || 0,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    }).returning();

    res.status(201).json({ ...campaign, scheduledAt: campaign.scheduledAt?.toISOString() ?? null, createdAt: campaign.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/survey-campaigns/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!["draft", "active", "paused", "completed"].includes(status)) {
      return res.status(400).json({ error: "Geçersiz durum." });
    }
    const now = new Date();
    const [campaign] = await db
      .update(surveyCampaignsTable)
      .set({ status, updatedAt: now, ...(status === "active" ? { totalSent: db.$count(surveyCampaignsTable) } : {}) })
      .where(eq(surveyCampaignsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      action: "CAMPAIGN_STATUS_CHANGE",
      entityType: "survey_campaigns",
      entityId: id,
      userId: "system",
      details: `Kampanya durumu "${status}" olarak güncellendi: ${campaign.name}`,
      piiMasked: false,
    });

    res.json({ ...campaign, scheduledAt: campaign.scheduledAt?.toISOString() ?? null, createdAt: campaign.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/survey-responses", async (req, res) => {
  try {
    const campaignId = req.query.campaignId ? Number(req.query.campaignId) : null;
    const surveyId = req.query.surveyId ? Number(req.query.surveyId) : null;

    const query = db
      .select({
        id: surveyResponsesTable.id,
        score: surveyResponsesTable.score,
        feedback: surveyResponsesTable.feedback,
        sentiment: surveyResponsesTable.sentiment,
        respondedAt: surveyResponsesTable.respondedAt,
        surveyId: surveyResponsesTable.surveyId,
        campaignId: surveyResponsesTable.campaignId,
        customerId: surveyResponsesTable.customerId,
        customerName: customersTable.name,
        surveyType: surveysTable.type,
        surveyTitle: surveysTable.title,
      })
      .from(surveyResponsesTable)
      .leftJoin(customersTable, eq(surveyResponsesTable.customerId, customersTable.id))
      .leftJoin(surveysTable, eq(surveyResponsesTable.surveyId, surveysTable.id))
      .orderBy(desc(surveyResponsesTable.respondedAt));

    let rows;
    if (campaignId) rows = await query.where(eq(surveyResponsesTable.campaignId, campaignId));
    else if (surveyId) rows = await query.where(eq(surveyResponsesTable.surveyId, surveyId));
    else rows = await query;

    res.json(rows.map(r => ({ ...r, respondedAt: r.respondedAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/survey-responses", async (req, res) => {
  try {
    const { surveyId, campaignId, customerId, score, feedback } = req.body;
    if (!surveyId || score === undefined) return res.status(400).json({ error: "surveyId ve score zorunludur." });

    const numScore = Number(score);
    const sentiment = numScore >= 7 ? "positive" : numScore >= 4 ? "neutral" : "negative";

    const [response] = await db.insert(surveyResponsesTable).values({
      surveyId: Number(surveyId),
      campaignId: campaignId ? Number(campaignId) : null,
      customerId: customerId ? Number(customerId) : null,
      score: numScore,
      feedback: feedback || null,
      sentiment,
    }).returning();

    if (campaignId) {
      await db.update(surveyCampaignsTable)
        .set({ totalCompleted: db.$count(surveyResponsesTable, eq(surveyResponsesTable.campaignId, Number(campaignId))), updatedAt: new Date() })
        .where(eq(surveyCampaignsTable.id, Number(campaignId)));
    }

    // Async: compare AI prediction vs actual survey score and record deviation
    if (customerId) {
      recordPredictionAccuracy(response.id, Number(customerId), numScore).catch(console.error);
    }

    res.status(201).json({ ...response, respondedAt: response.respondedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
