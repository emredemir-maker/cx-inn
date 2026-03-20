import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionRecordsTable, cxAnalysesTable, surveyCampaignsTable, surveyResponsesTable } from "@workspace/db";
import { eq, and, count, avg, desc, isNotNull, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

router.get("/dashboard/metrics", requireAuth, async (_req, res) => {
  try {
    const [totalCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.isExcluded, false));
    const [highChurn] = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.churnRisk, "high"), eq(customersTable.isExcluded, false)));
    const [totalInteractions] = await db.select({ count: count() }).from(interactionRecordsTable);
    const [openTickets] = await db.select({ count: count() }).from(interactionRecordsTable).where(eq(interactionRecordsTable.status, "open"));
    const [activeCampaigns] = await db.select({ count: count() }).from(surveyCampaignsTable).where(eq(surveyCampaignsTable.status, "active"));
    const [totalResponses] = await db.select({ count: count() }).from(surveyResponsesTable);
    const [analysisCount] = await db.select({ count: count() }).from(cxAnalysesTable);

    // NPS from cx_analyses (only entries with actual predicted values)
    const [npsResult] = await db
      .select({ avg: avg(cxAnalysesTable.predictedNps) })
      .from(cxAnalysesTable)
      .where(isNotNull(cxAnalysesTable.predictedNps));

    // CSAT from cx_analyses
    const [csatResult] = await db
      .select({ avg: avg(cxAnalysesTable.predictedCsat) })
      .from(cxAnalysesTable)
      .where(isNotNull(cxAnalysesTable.predictedCsat));

    // Also try survey responses for CSAT
    const [surveyAvg] = await db.select({ avg: avg(surveyResponsesTable.score) }).from(surveyResponsesTable);

    const npsAvg = npsResult?.avg ? parseFloat(npsResult.avg) : null;
    const csatAvg = csatResult?.avg ? parseFloat(csatResult.avg) : null;
    const surveyScore = surveyAvg?.avg ? parseFloat(surveyAvg.avg) : null;

    // Use real data only — no hardcoded fallbacks
    const npsScore = npsAvg !== null ? Math.round(npsAvg * 10) / 10 : null;
    const csatScore = csatAvg !== null
      ? Math.round(csatAvg * 10) / 10
      : (surveyScore !== null ? Math.round((surveyScore / 10) * 5 * 10) / 10 : null);

    res.json({
      npsScore,
      csatScore,
      totalCustomers: Number(totalCustomers?.count ?? 0),
      highChurnCount: Number(highChurn?.count ?? 0),
      totalInteractions: Number(totalInteractions?.count ?? 0),
      openTickets: Number(openTickets?.count ?? 0),
      activeCampaigns: Number(activeCampaigns?.count ?? 0),
      totalResponses: Number(totalResponses?.count ?? 0),
      analysisCount: Number(analysisCount?.count ?? 0),
      pendingApprovals: 0,
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get("/dashboard/trend", requireAuth, async (_req, res) => {
  try {
    // Build weekly trend from real cx_analyses data
    const rows = await db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${cxAnalysesTable.createdAt}), 'DD Mon')`,
        avgNps: avg(cxAnalysesTable.predictedNps),
        avgCsat: avg(cxAnalysesTable.predictedCsat),
      })
      .from(cxAnalysesTable)
      .where(isNotNull(cxAnalysesTable.predictedNps))
      .groupBy(sql`date_trunc('week', ${cxAnalysesTable.createdAt})`)
      .orderBy(sql`date_trunc('week', ${cxAnalysesTable.createdAt})`);

    const trend = rows.map(r => ({
      date: r.week,
      nps: r.avgNps ? Math.round(parseFloat(r.avgNps) * 10) / 10 : null,
      csat: r.avgCsat ? Math.round(parseFloat(r.avgCsat) * 10) / 10 : null,
    })).filter(r => r.nps !== null);

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get("/dashboard/recent-analyses", requireAuth, async (_req, res) => {
  try {
    const analyses = await db
      .select({
        id: cxAnalysesTable.id,
        customerId: cxAnalysesTable.customerId,
        customerName: customersTable.name,
        predictedNps: cxAnalysesTable.predictedNps,
        predictedCsat: cxAnalysesTable.predictedCsat,
        overallSentiment: cxAnalysesTable.overallSentiment,
        churnRisk: cxAnalysesTable.churnRisk,
        painPoints: cxAnalysesTable.painPoints,
        summary: cxAnalysesTable.summary,
        createdAt: cxAnalysesTable.createdAt,
      })
      .from(cxAnalysesTable)
      .leftJoin(customersTable, eq(cxAnalysesTable.customerId, customersTable.id))
      .orderBy(desc(cxAnalysesTable.createdAt))
      .limit(10);

    res.json(analyses.map(a => ({ ...a, createdAt: a.createdAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get("/dashboard/request-insights", requireAuth, async (_req, res) => {
  try {
    const [painPointRows, topicRows, statusRows, typeRows] = await Promise.all([
      // Top pain points (unnest text[] array, count occurrences)
      db.execute<{ pain_point: string; cnt: string }>(sql`
        SELECT unnest(pain_points) AS pain_point, COUNT(*)::int AS cnt
        FROM cx_analyses
        WHERE pain_points IS NOT NULL
        GROUP BY pain_point
        ORDER BY cnt DESC
        LIMIT 8
      `),
      // Top key topics
      db.execute<{ topic: string; cnt: string }>(sql`
        SELECT unnest(key_topics) AS topic, COUNT(*)::int AS cnt
        FROM cx_analyses
        WHERE key_topics IS NOT NULL
        GROUP BY topic
        ORDER BY cnt DESC
        LIMIT 12
      `),
      // Status distribution (exclude excluded records)
      db.execute<{ status: string; cnt: string }>(sql`
        SELECT status, COUNT(*)::int as cnt
        FROM interaction_records
        WHERE excluded_from_analysis = false OR excluded_from_analysis IS NULL
        GROUP BY status
        ORDER BY cnt DESC
      `),
      // Type distribution
      db.execute<{ type: string; cnt: string }>(sql`
        SELECT type, COUNT(*)::int as cnt
        FROM interaction_records
        WHERE excluded_from_analysis = false OR excluded_from_analysis IS NULL
        GROUP BY type
        ORDER BY cnt DESC
      `),
    ]);

    res.json({
      painPoints: painPointRows.rows.map(r => ({ label: r.pain_point, count: Number(r.cnt) })),
      topics: topicRows.rows.map(r => ({ label: r.topic, count: Number(r.cnt) })),
      statusBreakdown: statusRows.rows.map(r => ({ status: r.status, count: Number(r.cnt) })),
      typeBreakdown: typeRows.rows.map(r => ({ type: r.type, count: Number(r.cnt) })),
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
