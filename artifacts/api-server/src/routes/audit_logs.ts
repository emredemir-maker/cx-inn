import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/audit-logs", async (_req, res) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
