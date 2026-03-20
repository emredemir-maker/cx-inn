import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionsTable } from "@workspace/db";
import { eq, sql, isNotNull, and } from "drizzle-orm";
import { GetCustomerParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

router.get("/customers", requireAuth, async (_req, res) => {
  try {
    const customers = await db.select().from(customersTable)
      .where(eq(customersTable.isExcluded, false))
      .orderBy(customersTable.name);
    res.json(customers.map(c => ({
      ...c,
      lastInteraction: c.lastInteraction.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── CUSTOMER GROUPS (for campaign target picker) ────────────────────────────
router.get("/customers/groups", requireAuth, async (_req, res) => {
  try {
    const statsResult = await db.execute<{
      total: string; high_churn: string; mid_churn: string; low_churn: string;
      positive: string; neutral: string; negative: string;
      promoters: string; passives: string; detractors: string; no_nps: string;
    }>(sql`
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE churn_risk = 'high')::text as high_churn,
        COUNT(*) FILTER (WHERE churn_risk = 'medium')::text as mid_churn,
        COUNT(*) FILTER (WHERE churn_risk = 'low')::text as low_churn,
        COUNT(*) FILTER (WHERE sentiment = 'positive')::text as positive,
        COUNT(*) FILTER (WHERE sentiment = 'neutral')::text as neutral,
        COUNT(*) FILTER (WHERE sentiment = 'negative')::text as negative,
        COUNT(*) FILTER (WHERE nps_score >= 9)::text as promoters,
        COUNT(*) FILTER (WHERE nps_score >= 7 AND nps_score < 9)::text as passives,
        COUNT(*) FILTER (WHERE nps_score < 7 AND nps_score IS NOT NULL)::text as detractors,
        COUNT(*) FILTER (WHERE nps_score IS NULL)::text as no_nps
      FROM customers
      WHERE is_excluded = false OR is_excluded IS NULL
    `);
    const stats = statsResult.rows[0];

    const companyResult = await db.execute<{ company: string; count: string }>(sql`
      SELECT company, COUNT(*)::text as count
      FROM customers
      WHERE company IS NOT NULL AND company != ''
        AND (is_excluded = false OR is_excluded IS NULL)
      GROUP BY company
      ORDER BY COUNT(*) DESC
    `);

    res.json({
      total: Number(stats?.total ?? 0),
      groups: [
        { key: "high_churn", label: "Yüksek Churn Riskli", category: "churn", count: Number(stats?.high_churn ?? 0), color: "destructive" },
        { key: "mid_churn", label: "Orta Churn Riskli", category: "churn", count: Number(stats?.mid_churn ?? 0), color: "warning" },
        { key: "low_churn", label: "Düşük Churn Riskli", category: "churn", count: Number(stats?.low_churn ?? 0), color: "success" },
        { key: "promoters", label: "Promoterler (NPS ≥9)", category: "nps", count: Number(stats?.promoters ?? 0), color: "success" },
        { key: "passives", label: "Pasifler (NPS 7-8)", category: "nps", count: Number(stats?.passives ?? 0), color: "warning" },
        { key: "detractors", label: "Detractorlar (NPS <7)", category: "nps", count: Number(stats?.detractors ?? 0), color: "destructive" },
        { key: "positive_sentiment", label: "Pozitif Duygu", category: "sentiment", count: Number(stats?.positive ?? 0), color: "success" },
        { key: "neutral_sentiment", label: "Nötr Duygu", category: "sentiment", count: Number(stats?.neutral ?? 0), color: "primary" },
        { key: "negative_sentiment", label: "Negatif Duygu", category: "sentiment", count: Number(stats?.negative ?? 0), color: "destructive" },
        { key: "all", label: "Tüm Müşteriler", category: "all", count: Number(stats?.total ?? 0), color: "primary" },
      ],
      companies: companyResult.rows.map(r => ({ name: r.company, count: Number(r.count) })),
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetCustomerParams.parse({ id: Number(req.params.id) });
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) return res.status(404).json({ error: "Bulunamadı" });

    const interactions = await db.select().from(interactionsTable)
      .where(eq(interactionsTable.customerId, id))
      .orderBy(interactionsTable.createdAt);

    res.json({
      ...customer,
      lastInteraction: customer.lastInteraction.toISOString(),
      createdAt: customer.createdAt.toISOString(),
      interactions: interactions.map(i => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

export default router;
