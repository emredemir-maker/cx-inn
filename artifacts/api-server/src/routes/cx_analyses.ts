import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cxAnalysesTable, customersTable } from "@workspace/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";
import { analyzeCustomerById, bulkAnalyzeCustomers } from "../services/cx-analysis.service";
import { getUserId } from "../lib/audit";

const router: IRouter = Router();

// ─── LIST ────────────────────────────────────────────────────────────────────
router.get("/cx-analyses", requireAuth, async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const query = db
      .select({
        id: cxAnalysesTable.id,
        customerId: cxAnalysesTable.customerId,
        customerName: customersTable.name,
        predictedNps: cxAnalysesTable.predictedNps,
        predictedCsat: cxAnalysesTable.predictedCsat,
        overallSentiment: cxAnalysesTable.overallSentiment,
        churnRisk: cxAnalysesTable.churnRisk,
        painPoints: cxAnalysesTable.painPoints,
        keyTopics: cxAnalysesTable.keyTopics,
        summary: cxAnalysesTable.summary,
        recommendations: cxAnalysesTable.recommendations,
        interactionIds: cxAnalysesTable.interactionIds,
        model: cxAnalysesTable.model,
        createdAt: cxAnalysesTable.createdAt,
      })
      .from(cxAnalysesTable)
      .leftJoin(customersTable, eq(cxAnalysesTable.customerId, customersTable.id))
      .orderBy(desc(cxAnalysesTable.createdAt));

    const rows = customerId
      ? await query.where(
          and(
            eq(cxAnalysesTable.customerId, customerId),
            eq(customersTable.isExcluded, false),
            eq(customersTable.tenantId, tenantId),
          ),
        )
      : await query.where(
          and(
            eq(customersTable.isExcluded, false),
            eq(customersTable.tenantId, tenantId),
          ),
        );

    res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── SINGLE CUSTOMER ANALYZE ─────────────────────────────────────────────────
router.post("/cx-analyses/analyze", requireAuth, async (req, res) => {
  try {
    const { customerId, interactionIds } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId zorunludur." });

    const userId = getUserId(req.user);
    const analysis = await analyzeCustomerById(Number(customerId), {
      interactionIds: interactionIds?.map(Number),
      userId,
    });

    res.status(201).json({ ...analysis, createdAt: analysis.createdAt.toISOString() });
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("bulunamadı") || msg.includes("not found")) {
      return res.status(404).json({ error: sanitizeError(err) });
    }
    if (msg.includes("etkileşim kaydı bulunamadı")) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── BULK ANALYZE ─────────────────────────────────────────────────────────────
router.post("/cx-analyses/bulk-analyze", requireAuth, async (req, res) => {
  const { customerIds } = req.body as { customerIds: number[] };
  if (!customerIds?.length) return res.status(400).json({ error: "customerIds zorunludur." });

  // Capture userId and tenantId before the response is sent (req may not be accessible in background)
  const userId = getUserId(req.user);
  const tenantId = req.tenantId ?? null;

  res.json({ message: "Toplu analiz başlatıldı.", total: customerIds.length });

  // Fire-and-forget — runs after response is sent
  bulkAnalyzeCustomers(customerIds, userId, tenantId).catch((err) =>
    console.error("[cx_analyses] bulk analyze fatal error:", err),
  );
});

// ─── BULK STATUS — poll progress ──────────────────────────────────────────────
router.post("/cx-analyses/bulk-status", requireAuth, async (req, res) => {
  const { customerIds } = req.body as { customerIds: number[] };
  if (!customerIds?.length) return res.json({ done: 0, total: 0 });

  try {
    const rows = await db
      .select({ customerId: cxAnalysesTable.customerId })
      .from(cxAnalysesTable)
      .where(inArray(cxAnalysesTable.customerId, customerIds));

    const analyzed = new Set(rows.map((r) => r.customerId)).size;
    res.json({ done: analyzed, total: customerIds.length });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
