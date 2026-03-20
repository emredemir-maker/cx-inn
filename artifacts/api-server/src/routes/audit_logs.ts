import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

router.get("/audit-logs", requireRole("superadmin", "cx_manager"), async (_req, res) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
