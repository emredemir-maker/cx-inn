import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import { predictionAccuracyTable, customersTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

// ─── NPS/CSAT Impact by Tag ───────────────────────────────────────────────────
router.get("/analytics/nps-impact", requireAuth, async (_req, res) => {
  try {
    // Tag → NPS/CSAT impact
    const tagImpact = await db.execute<{
      tag: string;
      avg_nps: string;
      avg_csat: string;
      ticket_count: string;
    }>(sql`
      SELECT
        unnest(ir.tags) as tag,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(ca.predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(DISTINCT ir.id)::text as ticket_count
      FROM interaction_records ir
      JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
      WHERE ir.tags IS NOT NULL
        AND array_length(ir.tags, 1) > 0
        AND ca.predicted_nps IS NOT NULL
        AND NOT COALESCE(ir.excluded_from_analysis, false)
      GROUP BY tag
      ORDER BY ticket_count DESC
      LIMIT 20
    `);

    // Pain point → NPS/CSAT impact (sorted worst NPS first)
    const painImpact = await db.execute<{
      pain_point: string;
      avg_nps: string;
      avg_csat: string;
      count: string;
    }>(sql`
      SELECT
        unnest(ca.pain_points) as pain_point,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(ca.predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(*)::text as count
      FROM cx_analyses ca
      WHERE ca.pain_points IS NOT NULL
        AND array_length(ca.pain_points, 1) > 0
        AND ca.predicted_nps IS NOT NULL
      GROUP BY pain_point
      ORDER BY AVG(ca.predicted_nps) ASC
      LIMIT 15
    `);

    // Channel → NPS/CSAT impact
    const channelImpact = await db.execute<{
      channel: string;
      avg_nps: string;
      avg_csat: string;
      count: string;
    }>(sql`
      SELECT
        ir.channel,
        ROUND(AVG(ca.predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(ca.predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(DISTINCT ir.id)::text as count
      FROM interaction_records ir
      JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
      WHERE ca.predicted_nps IS NOT NULL
        AND NOT COALESCE(ir.excluded_from_analysis, false)
      GROUP BY ir.channel
      ORDER BY AVG(ca.predicted_nps) ASC
    `);

    // Sentiment distribution with NPS
    const sentimentDist = await db.execute<{
      overall_sentiment: string;
      avg_nps: string;
      avg_csat: string;
      count: string;
    }>(sql`
      SELECT
        overall_sentiment,
        ROUND(AVG(predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(*)::text as count
      FROM cx_analyses
      WHERE predicted_nps IS NOT NULL
      GROUP BY overall_sentiment
      ORDER BY AVG(predicted_nps) ASC
    `);

    // NPS band distribution
    const npsBands = await db.execute<{ band: string; count: string }>(sql`
      SELECT
        CASE
          WHEN predicted_nps >= 9 THEN 'promoter'
          WHEN predicted_nps >= 7 THEN 'passive'
          ELSE 'detractor'
        END as band,
        COUNT(*)::text as count
      FROM cx_analyses
      WHERE predicted_nps IS NOT NULL
      GROUP BY band
    `);

    // CSAT band distribution
    const csatBands = await db.execute<{ band: string; count: string }>(sql`
      SELECT
        CASE
          WHEN predicted_csat >= 4 THEN 'satisfied'
          WHEN predicted_csat >= 3 THEN 'neutral'
          ELSE 'dissatisfied'
        END as band,
        COUNT(*)::text as count
      FROM cx_analyses
      WHERE predicted_csat IS NOT NULL
      GROUP BY band
    `);

    // Customer verbatim quotes (worst NPS first for pain, best for positive)
    const verbatimNegative = await db.execute<{
      customer_name: string;
      content: string;
      predicted_nps: string;
      predicted_csat: string;
      key_topics: string;
      channel: string;
    }>(sql`
      SELECT DISTINCT ON (c.id)
        c.name as customer_name,
        LEFT(ir.content, 300) as content,
        ca.predicted_nps::text,
        ca.predicted_csat::text,
        array_to_string(ca.key_topics, ', ') as key_topics,
        ir.channel
      FROM interaction_records ir
      JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
      JOIN customers c ON c.id = ir.customer_id
      WHERE ca.overall_sentiment = 'negative'
        AND ir.content IS NOT NULL
        AND LENGTH(ir.content) > 60
        AND ir.content NOT LIKE '%Hello from AWS%'
      ORDER BY c.id, ca.predicted_nps ASC
      LIMIT 6
    `);

    const verbatimPositive = await db.execute<{
      customer_name: string;
      content: string;
      predicted_nps: string;
      predicted_csat: string;
      key_topics: string;
      channel: string;
    }>(sql`
      SELECT DISTINCT ON (c.id)
        c.name as customer_name,
        LEFT(ir.content, 300) as content,
        ca.predicted_nps::text,
        ca.predicted_csat::text,
        array_to_string(ca.key_topics, ', ') as key_topics,
        ir.channel
      FROM interaction_records ir
      JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
      JOIN customers c ON c.id = ir.customer_id
      WHERE ca.overall_sentiment = 'neutral'
        AND ir.content IS NOT NULL
        AND LENGTH(ir.content) > 60
      ORDER BY c.id, ca.predicted_nps DESC
      LIMIT 6
    `);

    // Overall averages
    const overall = await db.execute<{
      avg_nps: string;
      avg_csat: string;
      total_analyzed: string;
      high_risk: string;
    }>(sql`
      SELECT
        ROUND(AVG(predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(*)::text as total_analyzed,
        COUNT(*) FILTER (WHERE churn_risk = 'high')::text as high_risk
      FROM cx_analyses
      WHERE predicted_nps IS NOT NULL
    `);

    res.json({
      overall: overall.rows[0] ?? {},
      tagImpact: tagImpact.rows.map((r) => ({
        tag: r.tag,
        avgNps: parseFloat(r.avg_nps),
        avgCsat: parseFloat(r.avg_csat),
        ticketCount: parseInt(r.ticket_count),
      })),
      painImpact: painImpact.rows.map((r) => ({
        painPoint: r.pain_point,
        avgNps: parseFloat(r.avg_nps),
        avgCsat: parseFloat(r.avg_csat),
        count: parseInt(r.count),
      })),
      channelImpact: channelImpact.rows.map((r) => ({
        channel: r.channel,
        avgNps: parseFloat(r.avg_nps),
        avgCsat: parseFloat(r.avg_csat),
        count: parseInt(r.count),
      })),
      sentimentDist: sentimentDist.rows.map((r) => ({
        sentiment: r.overall_sentiment,
        avgNps: parseFloat(r.avg_nps),
        avgCsat: parseFloat(r.avg_csat),
        count: parseInt(r.count),
      })),
      npsBands: Object.fromEntries(npsBands.rows.map((r) => [r.band, parseInt(r.count)])),
      csatBands: Object.fromEntries(csatBands.rows.map((r) => [r.band, parseInt(r.count)])),
      verbatimNegative: verbatimNegative.rows,
      verbatimPositive: verbatimPositive.rows,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Monthly Trend & Insights ─────────────────────────────────────────────────
router.get("/analytics/monthly-trend", requireAuth, async (_req, res) => {
  try {
    const [monthlyStats, monthlyPainRows, monthlyChurnRows] = await Promise.all([
      // Monthly NPS/CSAT/volume from interaction records (interacted_at = actual date)
      db.execute<{
        month_key: string;
        month_label: string;
        avg_nps: string;
        avg_csat: string;
        interaction_count: string;
        analyzed_count: string;
        high_churn_count: string;
        negative_count: string;
        positive_count: string;
      }>(sql`
        WITH monthly AS (
          SELECT
            DATE_TRUNC('month', ir.interacted_at) AS month,
            ca.predicted_nps,
            ca.predicted_csat,
            ca.churn_risk,
            ca.overall_sentiment,
            ir.id as ir_id
          FROM interaction_records ir
          LEFT JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
          WHERE NOT COALESCE(ir.excluded_from_analysis, false)
        )
        SELECT
          TO_CHAR(month, 'YYYY-MM') AS month_key,
          TO_CHAR(month, 'Mon YYYY') AS month_label,
          ROUND(AVG(predicted_nps)::numeric, 1)::text AS avg_nps,
          ROUND(AVG(predicted_csat)::numeric, 1)::text AS avg_csat,
          COUNT(ir_id)::int AS interaction_count,
          COUNT(predicted_nps)::int AS analyzed_count,
          COUNT(CASE WHEN churn_risk = 'high' THEN 1 END)::int AS high_churn_count,
          COUNT(CASE WHEN overall_sentiment = 'negative' THEN 1 END)::int AS negative_count,
          COUNT(CASE WHEN overall_sentiment = 'positive' THEN 1 END)::int AS positive_count
        FROM monthly
        GROUP BY month
        ORDER BY month ASC
      `),
      // Monthly top pain points
      db.execute<{ month_key: string; pain_point: string; cnt: string }>(sql`
        WITH monthly_pains AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', ir.interacted_at), 'YYYY-MM') AS month_key,
            unnest(ca.pain_points) AS pain_point
          FROM interaction_records ir
          JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
          WHERE ca.pain_points IS NOT NULL
            AND NOT COALESCE(ir.excluded_from_analysis, false)
        ),
        ranked AS (
          SELECT
            month_key,
            pain_point,
            COUNT(*)::int AS cnt,
            ROW_NUMBER() OVER (PARTITION BY month_key ORDER BY COUNT(*) DESC) AS rn
          FROM monthly_pains
          GROUP BY month_key, pain_point
        )
        SELECT month_key, pain_point, cnt FROM ranked WHERE rn <= 5
        ORDER BY month_key, cnt DESC
      `),
      // Monthly churn risk distribution
      db.execute<{ month_key: string; churn_risk: string; cnt: string }>(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', ir.interacted_at), 'YYYY-MM') AS month_key,
          ca.churn_risk,
          COUNT(DISTINCT ca.customer_id)::int AS cnt
        FROM interaction_records ir
        JOIN cx_analyses ca ON ir.id = ANY(ca.interaction_ids)
        WHERE NOT COALESCE(ir.excluded_from_analysis, false)
          AND ca.churn_risk IS NOT NULL
        GROUP BY month_key, ca.churn_risk
        ORDER BY month_key, cnt DESC
      `),
    ]);

    // Group pain points and churn by month key
    const painByMonth: Record<string, { painPoint: string; count: number }[]> = {};
    for (const r of monthlyPainRows.rows) {
      if (!painByMonth[r.month_key]) painByMonth[r.month_key] = [];
      painByMonth[r.month_key].push({ painPoint: r.pain_point, count: Number(r.cnt) });
    }

    const churnByMonth: Record<string, Record<string, number>> = {};
    for (const r of monthlyChurnRows.rows) {
      if (!churnByMonth[r.month_key]) churnByMonth[r.month_key] = {};
      churnByMonth[r.month_key][r.churn_risk] = Number(r.cnt);
    }

    const months = monthlyStats.rows.map((r) => ({
      monthKey: r.month_key,
      monthLabel: r.month_label,
      avgNps: r.avg_nps ? parseFloat(r.avg_nps) : null,
      avgCsat: r.avg_csat ? parseFloat(r.avg_csat) : null,
      interactionCount: Number(r.interaction_count),
      analyzedCount: Number(r.analyzed_count),
      highChurnCount: Number(r.high_churn_count),
      negativeCount: Number(r.negative_count),
      positiveCount: Number(r.positive_count),
      topPainPoints: painByMonth[r.month_key] ?? [],
      churnDist: churnByMonth[r.month_key] ?? {},
    }));

    res.json({ months });
  } catch (err) {
    console.error("Monthly trend error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Prediction Accuracy ─────────────────────────────────────────────────────
router.get("/analytics/prediction-accuracy", requireAuth, async (_req, res) => {
  try {
    // Overall stats
    const statsResult = await db.execute<{
      total: string; mae_nps: string; mae_csat: string;
      avg_dev_nps: string; avg_dev_csat: string;
      over_count: string; under_count: string;
    }>(sql`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(CASE WHEN survey_type = 'nps' THEN abs_deviation END)::numeric, 2) AS mae_nps,
        ROUND(AVG(CASE WHEN survey_type = 'csat' THEN abs_deviation END)::numeric, 2) AS mae_csat,
        ROUND(AVG(CASE WHEN survey_type = 'nps' THEN deviation END)::numeric, 2) AS avg_dev_nps,
        ROUND(AVG(CASE WHEN survey_type = 'csat' THEN deviation END)::numeric, 2) AS avg_dev_csat,
        SUM(CASE WHEN over_predicted THEN 1 ELSE 0 END) AS over_count,
        SUM(CASE WHEN NOT over_predicted THEN 1 ELSE 0 END) AS under_count
      FROM prediction_accuracy
    `);
    const stats = statsResult.rows[0];

    // Per-customer breakdown
    const rows = await db.select({
      id: predictionAccuracyTable.id,
      customerId: predictionAccuracyTable.customerId,
      customerName: customersTable.name,
      customerCompany: customersTable.company,
      surveyType: predictionAccuracyTable.surveyType,
      predictedScore: predictionAccuracyTable.predictedScore,
      actualScore: predictionAccuracyTable.actualScore,
      deviation: predictionAccuracyTable.deviation,
      absDeviation: predictionAccuracyTable.absDeviation,
      overPredicted: predictionAccuracyTable.overPredicted,
      usedForLearning: predictionAccuracyTable.usedForLearning,
      recordedAt: predictionAccuracyTable.recordedAt,
    }).from(predictionAccuracyTable)
      .leftJoin(customersTable, eq(predictionAccuracyTable.customerId, customersTable.id))
      .orderBy(desc(predictionAccuracyTable.recordedAt))
      .limit(100);

    // Monthly MAE trend
    const monthlyTrendResult = await db.execute<{
      month: string; mae: string; record_count: string;
    }>(sql`
      SELECT
        TO_CHAR(recorded_at, 'YYYY-MM') AS month,
        ROUND(AVG(abs_deviation)::numeric, 2) AS mae,
        COUNT(*) AS record_count
      FROM prediction_accuracy
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    res.json({
      stats: {
        total: Number(stats?.total ?? 0),
        maeNps: stats?.mae_nps != null ? Number(stats.mae_nps) : null,
        maeCsat: stats?.mae_csat != null ? Number(stats.mae_csat) : null,
        avgDevNps: stats?.avg_dev_nps != null ? Number(stats.avg_dev_nps) : null,
        avgDevCsat: stats?.avg_dev_csat != null ? Number(stats.avg_dev_csat) : null,
        overCount: Number(stats?.over_count ?? 0),
        underCount: Number(stats?.under_count ?? 0),
      },
      rows: rows.map(r => ({
        ...r,
        predictedScore: r.predictedScore != null ? Number(r.predictedScore) : null,
        actualScore: r.actualScore != null ? Number(r.actualScore) : null,
        deviation: r.deviation != null ? Number(r.deviation) : null,
        absDeviation: r.absDeviation != null ? Number(r.absDeviation) : null,
        recordedAt: r.recordedAt?.toISOString(),
      })),
      monthlyTrend: monthlyTrendResult.rows.map(m => ({
        month: m.month,
        mae: Number(m.mae),
        recordCount: Number(m.record_count),
      })),
    });
  } catch (err) {
    console.error("Prediction accuracy error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
