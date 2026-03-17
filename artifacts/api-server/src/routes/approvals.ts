import { Router, type IRouter, type Request, type Response } from "express";
import { db, surveysTable, surveyCampaignsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireRole, requireAuth } from "../middleware/requireRole";
import type { UserRole } from "@workspace/db";

const router: IRouter = Router();

type ApprovalTarget = "survey" | "campaign";

function getTable(target: ApprovalTarget) {
  return target === "survey" ? surveysTable : surveyCampaignsTable;
}

// Get pending approvals (cx_manager and superadmin can see all)
router.get(
  "/approvals/pending",
  requireRole("cx_manager", "superadmin"),
  async (_req: Request, res: Response) => {
    const [surveys, campaigns] = await Promise.all([
      db
        .select()
        .from(surveysTable)
        .where(eq(surveysTable.approvalStatus, "pending_approval")),
      db
        .select()
        .from(surveyCampaignsTable)
        .where(eq(surveyCampaignsTable.approvalStatus, "pending_approval")),
    ]);
    res.json({ surveys, campaigns });
  },
);

// Submit a survey for approval (cx_user can only submit their own)
router.post(
  "/approvals/surveys/:id/submit",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as { id: string; role: UserRole };

    const [survey] = await db
      .select()
      .from(surveysTable)
      .where(eq(surveysTable.id, Number(id)));

    if (!survey) {
      res.status(404).json({ error: "Anket bulunamadı" });
      return;
    }

    // cx_user can only submit their own surveys
    if (user.role === "cx_user" && survey.createdBy !== user.id) {
      res.status(403).json({ error: "Yetkiniz yok" });
      return;
    }

    const [updated] = await db
      .update(surveysTable)
      .set({ approvalStatus: "pending_approval", updatedAt: new Date() })
      .where(eq(surveysTable.id, Number(id)))
      .returning();

    res.json(updated);
  },
);

// Submit a campaign for approval
router.post(
  "/approvals/campaigns/:id/submit",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as { id: string; role: UserRole };

    const [campaign] = await db
      .select()
      .from(surveyCampaignsTable)
      .where(eq(surveyCampaignsTable.id, Number(id)));

    if (!campaign) {
      res.status(404).json({ error: "Kampanya bulunamadı" });
      return;
    }

    if (user.role === "cx_user" && campaign.createdBy !== user.id) {
      res.status(403).json({ error: "Yetkiniz yok" });
      return;
    }

    const [updated] = await db
      .update(surveyCampaignsTable)
      .set({ approvalStatus: "pending_approval", updatedAt: new Date() })
      .where(eq(surveyCampaignsTable.id, Number(id)))
      .returning();

    res.json(updated);
  },
);

// Approve a survey (cx_manager or superadmin)
router.post(
  "/approvals/surveys/:id/approve",
  requireRole("cx_manager", "superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const user = req.user as { id: string };

    const [updated] = await db
      .update(surveysTable)
      .set({
        approvalStatus: "approved",
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(surveysTable.id, Number(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Anket bulunamadı" });
      return;
    }
    res.json(updated);
  },
);

// Approve a campaign (cx_manager or superadmin)
router.post(
  "/approvals/campaigns/:id/approve",
  requireRole("cx_manager", "superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const user = req.user as { id: string };

    const [updated] = await db
      .update(surveyCampaignsTable)
      .set({
        approvalStatus: "approved",
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(surveyCampaignsTable.id, Number(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Kampanya bulunamadı" });
      return;
    }
    res.json(updated);
  },
);

// Reject a survey (cx_manager or superadmin)
router.post(
  "/approvals/surveys/:id/reject",
  requireRole("cx_manager", "superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const user = req.user as { id: string };

    const [updated] = await db
      .update(surveysTable)
      .set({
        approvalStatus: "rejected",
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(surveysTable.id, Number(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Anket bulunamadı" });
      return;
    }
    res.json(updated);
  },
);

// Reject a campaign (cx_manager or superadmin)
router.post(
  "/approvals/campaigns/:id/reject",
  requireRole("cx_manager", "superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const user = req.user as { id: string };

    const [updated] = await db
      .update(surveyCampaignsTable)
      .set({
        approvalStatus: "rejected",
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(surveyCampaignsTable.id, Number(id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Kampanya bulunamadı" });
      return;
    }
    res.json(updated);
  },
);

export default router;
