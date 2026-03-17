import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiApprovalsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ApproveAiContentParams, RejectAiContentParams, RejectAiContentBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ai-approvals", async (_req, res) => {
  try {
    const approvals = await db.select().from(aiApprovalsTable).orderBy(aiApprovalsTable.createdAt);
    res.json(approvals.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/ai-approvals/:id/approve", async (req, res) => {
  try {
    const { id } = ApproveAiContentParams.parse({ id: Number(req.params.id) });
    const [approval] = await db.update(aiApprovalsTable)
      .set({ status: "approved" })
      .where(eq(aiApprovalsTable.id, id))
      .returning();

    if (!approval) return res.status(404).json({ error: "Bulunamadı" });

    await db.insert(auditLogsTable).values({
      action: "APPROVE",
      entityType: "ai_approval",
      entityId: id,
      userId: "manager",
      details: `AI içeriği onaylandı: ${id}`,
      piiMasked: true,
    });

    res.json({ ...approval, createdAt: approval.createdAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post("/ai-approvals/:id/reject", async (req, res) => {
  try {
    const { id } = RejectAiContentParams.parse({ id: Number(req.params.id) });
    const body = RejectAiContentBody.parse(req.body);
    const [approval] = await db.update(aiApprovalsTable)
      .set({ status: "rejected", rejectionReason: body.reason })
      .where(eq(aiApprovalsTable.id, id))
      .returning();

    if (!approval) return res.status(404).json({ error: "Bulunamadı" });

    await db.insert(auditLogsTable).values({
      action: "REJECT",
      entityType: "ai_approval",
      entityId: id,
      userId: "manager",
      details: `AI içeriği reddedildi: ${id}, sebep: ${body.reason}`,
      piiMasked: true,
    });

    res.json({ ...approval, createdAt: approval.createdAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
