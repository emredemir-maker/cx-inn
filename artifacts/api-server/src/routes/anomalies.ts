import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveyCampaignsTable, surveysTable, auditLogsTable } from "@workspace/db/schema";
import { sql, desc, eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── ANOMALY DETECTION ────────────────────────────────────────────────────────
// Returns customers with detected CX anomalies based on latest AI analysis
router.get("/anomalies", async (_req, res) => {
  try {
    const rows = await db.execute<{
      id: string;
      name: string;
      email: string;
      company: string | null;
      segment: string | null;
      analysis_id: string;
      predicted_nps: string | null;
      predicted_csat: string | null;
      overall_sentiment: string;
      churn_risk: string;
      pain_points: string[] | null;
      key_topics: string[] | null;
      summary: string | null;
      recommendations: string | null;
      analyzed_at: string;
      open_tickets: string;
      severity: string;
      triggers: string[];
    }>(sql`
      WITH latest_analyses AS (
        SELECT DISTINCT ON (customer_id) 
          id, customer_id, predicted_nps, predicted_csat,
          overall_sentiment, churn_risk, pain_points, key_topics,
          summary, recommendations, created_at
        FROM cx_analyses
        ORDER BY customer_id, created_at DESC
      ),
      -- Only customers with at least one non-excluded interaction record
      active_customers AS (
        SELECT DISTINCT customer_id
        FROM interaction_records
        WHERE excluded_from_analysis = false OR excluded_from_analysis IS NULL
      ),
      open_ticket_counts AS (
        SELECT customer_id, COUNT(*)::int as open_count
        FROM interaction_records
        WHERE status = 'open'
          AND (excluded_from_analysis = false OR excluded_from_analysis IS NULL)
        GROUP BY customer_id
      ),
      scored AS (
        SELECT
          c.id,
          c.name,
          c.email,
          c.company,
          c.segment,
          la.id as analysis_id,
          la.predicted_nps,
          la.predicted_csat,
          la.overall_sentiment,
          la.churn_risk,
          la.pain_points,
          la.key_topics,
          la.summary,
          la.recommendations,
          la.created_at as analyzed_at,
          COALESCE(otc.open_count, 0) as open_tickets,
          CASE
            WHEN la.churn_risk = 'high' AND COALESCE(la.predicted_nps, 10) <= 3 THEN 'critical'
            WHEN la.churn_risk = 'high' OR COALESCE(la.predicted_nps, 10) <= 4 THEN 'high'
            WHEN la.overall_sentiment = 'negative' OR COALESCE(la.predicted_nps, 10) <= 5 THEN 'medium'
            WHEN COALESCE(la.predicted_nps, 10) <= 6 OR COALESCE(la.predicted_csat, 5) <= 2 THEN 'low'
            ELSE NULL
          END as severity,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN la.churn_risk = 'high' THEN 'Yüksek churn riski tespit edildi' END,
            CASE WHEN COALESCE(la.predicted_nps, 10) <= 3 THEN 'Kritik NPS: ' || ROUND(la.predicted_nps::numeric, 1)::text END,
            CASE WHEN COALESCE(la.predicted_nps, 10) > 3 AND COALESCE(la.predicted_nps, 10) <= 5 THEN 'Düşük NPS: ' || ROUND(la.predicted_nps::numeric, 1)::text END,
            CASE WHEN COALESCE(la.predicted_nps, 10) > 5 AND COALESCE(la.predicted_nps, 10) <= 6 THEN 'Pasif NPS bölgesi: ' || ROUND(la.predicted_nps::numeric, 1)::text END,
            CASE WHEN la.overall_sentiment = 'negative' THEN 'Negatif duygu durumu' END,
            CASE WHEN COALESCE(otc.open_count, 0) >= 3 THEN 'Açık talep birikimi: ' || otc.open_count::text || ' kayıt' END,
            CASE WHEN COALESCE(la.predicted_csat, 5) <= 2 THEN 'Düşük CSAT: ' || ROUND(la.predicted_csat::numeric, 1)::text || '/5' END
          ], NULL) as triggers
        FROM customers c
        INNER JOIN latest_analyses la ON la.customer_id = c.id
        -- Exclude customers whose ALL interaction records are excluded
        INNER JOIN active_customers ac ON ac.customer_id = c.id
        LEFT JOIN open_ticket_counts otc ON otc.customer_id = c.id
        WHERE (
          la.churn_risk = 'high'
          OR COALESCE(la.predicted_nps, 10) <= 6
          OR la.overall_sentiment = 'negative'
          OR COALESCE(otc.open_count, 0) >= 3
        )
      )
      SELECT * FROM scored
      WHERE severity IS NOT NULL
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          WHEN 'medium'   THEN 3
          ELSE 4
        END,
        analyzed_at DESC
    `);

    const anomalies = rows.rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      email: r.email,
      company: r.company,
      segment: r.segment,
      analysisId: Number(r.analysis_id),
      predictedNps: r.predicted_nps != null ? parseFloat(r.predicted_nps) : null,
      predictedCsat: r.predicted_csat != null ? parseFloat(r.predicted_csat) : null,
      overallSentiment: r.overall_sentiment,
      churnRisk: r.churn_risk,
      painPoints: r.pain_points ?? [],
      keyTopics: r.key_topics ?? [],
      summary: r.summary,
      recommendations: r.recommendations,
      analyzedAt: r.analyzed_at,
      openTickets: Number(r.open_tickets),
      severity: r.severity as "critical" | "high" | "medium" | "low",
      triggers: r.triggers ?? [],
    }));

    const summary = {
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === "critical").length,
      high: anomalies.filter(a => a.severity === "high").length,
      medium: anomalies.filter(a => a.severity === "medium").length,
      low: anomalies.filter(a => a.severity === "low").length,
    };

    res.json({ summary, anomalies });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── TRIGGER SURVEY FOR ANOMALOUS CUSTOMER ───────────────────────────────────
router.post("/anomalies/:customerId/trigger-survey", async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    const { surveyId, customerName } = req.body;

    if (!surveyId) return res.status(400).json({ error: "surveyId zorunludur." });

    const survey = await db.select().from(surveysTable).where(eq(surveysTable.id, Number(surveyId))).limit(1);
    if (!survey.length) return res.status(404).json({ error: "Anket bulunamadı." });

    const [campaign] = await db.insert(surveyCampaignsTable).values({
      surveyId: Number(surveyId),
      name: `Anomali Tetikleme — ${customerName ?? `Müşteri #${customerId}`}`,
      description: `Anomali motoru tarafından otomatik oluşturuldu. Müşteri ID: ${customerId}`,
      channel: "email",
      targetSegment: customerName ?? `Müşteri #${customerId}`,
      totalTargeted: 1,
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "ANOMALY_SURVEY_TRIGGERED",
      entityType: "survey_campaigns",
      entityId: campaign.id,
      userId: "system",
      details: `Anomali motoru anket tetikledi: Müşteri #${customerId} → Kampanya #${campaign.id}`,
      piiMasked: false,
    });

    res.status(201).json({
      ...campaign,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── BULK TRIGGER (trigger surveys for all critical/high anomalies) ────────────
router.post("/anomalies/bulk-trigger", async (req, res) => {
  try {
    const { surveyId, minSeverity = "high" } = req.body;
    if (!surveyId) return res.status(400).json({ error: "surveyId zorunludur." });

    const severityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
    const minLevel = severityOrder[minSeverity] ?? 2;

    const anomalyRows = await db.execute<{ id: string; name: string; severity: string }>(sql`
      WITH latest_analyses AS (
        SELECT DISTINCT ON (customer_id)
          id, customer_id, predicted_nps, predicted_csat, overall_sentiment, churn_risk, created_at
        FROM cx_analyses
        ORDER BY customer_id, created_at DESC
      ),
      open_ticket_counts AS (
        SELECT customer_id, COUNT(*)::int as open_count
        FROM interaction_records WHERE status = 'open'
        GROUP BY customer_id
      ),
      scored AS (
        SELECT
          c.id, c.name,
          CASE
            WHEN la.churn_risk = 'high' AND COALESCE(la.predicted_nps, 10) <= 3 THEN 'critical'
            WHEN la.churn_risk = 'high' OR COALESCE(la.predicted_nps, 10) <= 4 THEN 'high'
            WHEN la.overall_sentiment = 'negative' OR COALESCE(la.predicted_nps, 10) <= 5 THEN 'medium'
            WHEN COALESCE(la.predicted_nps, 10) <= 6 THEN 'low'
            ELSE NULL
          END as severity
        FROM customers c
        INNER JOIN latest_analyses la ON la.customer_id = c.id
        LEFT JOIN open_ticket_counts otc ON otc.customer_id = c.id
        WHERE la.churn_risk = 'high' OR COALESCE(la.predicted_nps, 10) <= 6 OR la.overall_sentiment = 'negative'
      )
      SELECT * FROM scored WHERE severity IS NOT NULL
    `);

    const targets = anomalyRows.rows.filter(r =>
      (severityOrder[r.severity] ?? 99) <= minLevel
    );

    if (targets.length === 0) return res.json({ triggered: 0, campaigns: [] });

    const campaigns = [];
    for (const t of targets) {
      const [campaign] = await db.insert(surveyCampaignsTable).values({
        surveyId: Number(surveyId),
        name: `Toplu Anomali — ${t.name}`,
        description: `Toplu anomali tetiklemesi. Müşteri ID: ${t.id}`,
        channel: "email",
        targetSegment: t.name,
        totalTargeted: 1,
      }).returning();
      campaigns.push(campaign);
    }

    await db.insert(auditLogsTable).values({
      action: "ANOMALY_BULK_TRIGGER",
      entityType: "survey_campaigns",
      entityId: 0,
      userId: "system",
      details: `Toplu anomali tetiklemesi: ${campaigns.length} kampanya oluşturuldu (minSeverity: ${minSeverity})`,
      piiMasked: false,
    });

    res.json({ triggered: campaigns.length, campaigns });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
