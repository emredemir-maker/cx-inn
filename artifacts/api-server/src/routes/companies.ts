import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionRecordsTable, cxAnalysesTable } from "@workspace/db/schema";
import { eq, desc, count, isNotNull, sql } from "drizzle-orm";

const router: IRouter = Router();

// ─── LIST ALL COMPANIES with aggregated metrics ───────────────────────────────
router.get("/companies", async (_req, res) => {
  try {
    // Customers grouped by company
    const customerRows = await db
      .select({
        company: customersTable.company,
        customerCount: count(customersTable.id),
        avgNps: sql<number>`AVG(${customersTable.npsScore})`,
        highChurn: sql<number>`SUM(CASE WHEN ${customersTable.churnRisk} = 'high' THEN 1 ELSE 0 END)`,
        negativeSentiment: sql<number>`SUM(CASE WHEN ${customersTable.sentiment} = 'negative' THEN 1 ELSE 0 END)`,
      })
      .from(customersTable)
      .where(isNotNull(customersTable.company))
      .groupBy(customersTable.company)
      .orderBy(sql`COUNT(${customersTable.id}) DESC`);

    // Interaction stats per company
    const interactionRows = await db
      .select({
        company: customersTable.company,
        totalTickets: count(interactionRecordsTable.id),
        openTickets: sql<number>`SUM(CASE WHEN ${interactionRecordsTable.status} = 'open' THEN 1 ELSE 0 END)`,
        resolvedTickets: sql<number>`SUM(CASE WHEN ${interactionRecordsTable.status} = 'resolved' THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(${interactionRecordsTable.durationSeconds})`,
      })
      .from(interactionRecordsTable)
      .leftJoin(customersTable, eq(interactionRecordsTable.customerId, customersTable.id))
      .where(isNotNull(customersTable.company))
      .groupBy(customersTable.company);

    const interactionMap: Record<string, any> = {};
    for (const r of interactionRows) {
      if (r.company) interactionMap[r.company] = r;
    }

    // Latest analyses per company (for pain points / key topics)
    const analysisRows = await db
      .select({
        company: customersTable.company,
        painPoints: cxAnalysesTable.painPoints,
        keyTopics: cxAnalysesTable.keyTopics,
        predictedCsat: cxAnalysesTable.predictedCsat,
        churnRisk: cxAnalysesTable.churnRisk,
        createdAt: cxAnalysesTable.createdAt,
      })
      .from(cxAnalysesTable)
      .leftJoin(customersTable, eq(cxAnalysesTable.customerId, customersTable.id))
      .where(isNotNull(customersTable.company))
      .orderBy(desc(cxAnalysesTable.createdAt));

    // Aggregate pain points and key topics per company
    const companyAnalyses: Record<string, { painPoints: string[]; keyTopics: string[]; csatValues: number[]; analysisCount: number }> = {};
    for (const a of analysisRows) {
      if (!a.company) continue;
      if (!companyAnalyses[a.company]) companyAnalyses[a.company] = { painPoints: [], keyTopics: [], csatValues: [], analysisCount: 0 };
      const ca = companyAnalyses[a.company];
      ca.analysisCount++;
      if (a.painPoints) ca.painPoints.push(...a.painPoints);
      if (a.keyTopics) ca.keyTopics.push(...a.keyTopics);
      if (a.predictedCsat) ca.csatValues.push(a.predictedCsat);
    }

    // Deduplicate and limit topics/pain points
    const dedupe = (arr: string[]) => [...new Set(arr)].slice(0, 8);

    const result = customerRows.map(cr => {
      const company = cr.company!;
      const ixStats = interactionMap[company] || {};
      const agg = companyAnalyses[company] || { painPoints: [], keyTopics: [], csatValues: [], analysisCount: 0 };
      const avgCsat = agg.csatValues.length > 0 ? agg.csatValues.reduce((a, b) => a + b, 0) / agg.csatValues.length : null;

      return {
        company,
        customerCount: Number(cr.customerCount),
        avgNps: cr.avgNps != null ? Math.round(Number(cr.avgNps) * 10) / 10 : null,
        avgCsat: avgCsat != null ? Math.round(avgCsat * 10) / 10 : null,
        highChurnCount: Number(cr.highChurn),
        negativeSentimentCount: Number(cr.negativeSentiment),
        totalTickets: Number(ixStats.totalTickets || 0),
        openTickets: Number(ixStats.openTickets || 0),
        resolvedTickets: Number(ixStats.resolvedTickets || 0),
        avgResolutionSeconds: ixStats.avgDuration ? Math.round(Number(ixStats.avgDuration)) : null,
        analysisCount: agg.analysisCount,
        painPoints: dedupe(agg.painPoints),
        keyTopics: dedupe(agg.keyTopics),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── COMPANY DETAIL — list customers of a company ────────────────────────────
router.get("/companies/:name/customers", async (req, res) => {
  try {
    const company = decodeURIComponent(req.params.name);
    const rows = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.company, company))
      .orderBy(desc(customersTable.lastInteraction));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
