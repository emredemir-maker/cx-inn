import { Router } from "express";
import { db } from "@workspace/db";
import { interactionRecordsTable, customersTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/requireRole";
import { sanitizeError } from "../../lib/sanitize-error";
import { writeAuditLog, getUserId } from "../../lib/audit";
import { analyzeCustomer } from "../../lib/analyze";

const router = Router();

// ─── LIST ─────────────────────────────────────────────────────────────────────
router.get("/interaction-records", requireAuth, async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const query = db
      .select({
        id: interactionRecordsTable.id,
        customerId: interactionRecordsTable.customerId,
        customerName: customersTable.name,
        type: interactionRecordsTable.type,
        subject: interactionRecordsTable.subject,
        content: interactionRecordsTable.content,
        status: interactionRecordsTable.status,
        channel: interactionRecordsTable.channel,
        agentName: interactionRecordsTable.agentName,
        durationSeconds: interactionRecordsTable.durationSeconds,
        resolution: interactionRecordsTable.resolution,
        analysisRequested: interactionRecordsTable.analysisRequested,
        isCustomerRequest: interactionRecordsTable.isCustomerRequest,
        relevanceReason: interactionRecordsTable.relevanceReason,
        excludedFromAnalysis: interactionRecordsTable.excludedFromAnalysis,
        exclusionReason: interactionRecordsTable.exclusionReason,
        company: customersTable.company,
        interactedAt: interactionRecordsTable.interactedAt,
        createdAt: interactionRecordsTable.createdAt,
      })
      .from(interactionRecordsTable)
      .leftJoin(customersTable, eq(interactionRecordsTable.customerId, customersTable.id))
      .orderBy(desc(interactionRecordsTable.interactedAt));

    const rows = customerId
      ? await query.where(eq(interactionRecordsTable.customerId, customerId))
      : await query;

    res.json(
      rows.map((r) => ({
        ...r,
        interactedAt: r.interactedAt?.toISOString(),
        createdAt: r.createdAt?.toISOString(),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── CREATE SINGLE ─────────────────────────────────────────────────────────────
router.post("/interaction-records", requireAuth, async (req, res) => {
  try {
    const { customerId, type, subject, content, status, channel, agentName, durationSeconds, resolution, interactedAt } = req.body;
    if (!customerId || !type || !subject || !content) {
      return res.status(400).json({ error: "customerId, type, subject ve content zorunludur." });
    }
    const [record] = await db
      .insert(interactionRecordsTable)
      .values({
        customerId: Number(customerId),
        type,
        subject,
        content,
        status: status || "open",
        channel: channel || "email",
        agentName: agentName || null,
        durationSeconds: durationSeconds ? Number(durationSeconds) : null,
        resolution: resolution || null,
        interactedAt: interactedAt ? new Date(interactedAt) : new Date(),
      })
      .returning();

    await writeAuditLog(
      "CREATE_INTERACTION",
      "interaction_records",
      record.id,
      getUserId(req.user),
      `${type} kaydı eklendi: ${subject} (Müşteri ID: ${customerId})`,
    );

    res.status(201).json({
      ...record,
      interactedAt: record.interactedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── TOGGLE EXCLUSION ─────────────────────────────────────────────────────────
router.patch("/interaction-records/:id/toggle-exclusion", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [current] = await db
      .select({ excluded: interactionRecordsTable.excludedFromAnalysis, customerId: interactionRecordsTable.customerId })
      .from(interactionRecordsTable)
      .where(eq(interactionRecordsTable.id, id));
    if (!current) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const newVal = !current.excluded;
    const [updated] = await db
      .update(interactionRecordsTable)
      .set({ excludedFromAnalysis: newVal, exclusionReason: newVal ? (reason ?? null) : null })
      .where(eq(interactionRecordsTable.id, id))
      .returning();

    res.json({ ...updated, reanalysisTriggered: true, interactedAt: updated.interactedAt.toISOString(), createdAt: updated.createdAt.toISOString() });

    // Sync customer isExcluded flag
    syncCustomerExclusion(current.customerId);

    // Re-analyze to reflect updated exclusion
    analyzeCustomer(current.customerId).catch((e) =>
      console.error(`Re-analysis failed for customer ${current.customerId}:`, e),
    );
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── COMPANY-LEVEL BULK EXCLUSION ─────────────────────────────────────────────
router.post("/interaction-records/company-exclude", requireAuth, async (req, res) => {
  try {
    const { company, reason, exclude } = req.body as { company: string; reason: string; exclude: boolean };
    if (!company) return res.status(400).json({ error: "Firma adı gerekli" });

    const companyCustomers = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.company, company));
    const customerIds = companyCustomers.map((r) => r.id);
    if (customerIds.length === 0) return res.json({ updated: 0 });

    const updated = await db
      .update(interactionRecordsTable)
      .set({ excludedFromAnalysis: exclude, exclusionReason: exclude ? (reason || null) : null })
      .where(inArray(interactionRecordsTable.customerId, customerIds))
      .returning({ id: interactionRecordsTable.id });

    res.json({ updated: updated.length, company, customerIds, reanalysisTriggered: true });

    // Background: sync isExcluded + re-analyze
    (async () => {
      for (const cid of customerIds) {
        syncCustomerExclusion(cid);
        try {
          await analyzeCustomer(cid);
          await new Promise((r) => setTimeout(r, 600));
        } catch (e) {
          console.error(`Re-analysis failed for customer ${cid}:`, e);
        }
      }
    })();
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete("/interaction-records/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(interactionRecordsTable).where(eq(interactionRecordsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function syncCustomerExclusion(customerId: number): void {
  (async () => {
    try {
      const allRecs = await db
        .select({ excluded: interactionRecordsTable.excludedFromAnalysis })
        .from(interactionRecordsTable)
        .where(eq(interactionRecordsTable.customerId, customerId));
      const allExcluded = allRecs.length > 0 && allRecs.every((r) => r.excluded);
      await db
        .update(customersTable)
        .set({ isExcluded: allExcluded })
        .where(eq(customersTable.id, customerId));
    } catch (e) {
      console.error("isExcluded sync failed:", e);
    }
  })();
}

export default router;
