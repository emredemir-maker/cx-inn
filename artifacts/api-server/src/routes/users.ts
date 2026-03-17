import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";
import type { UserRole } from "@workspace/db";

const router: IRouter = Router();

const VALID_ROLES: UserRole[] = ["superadmin", "cx_manager", "cx_user"];

// List all users (superadmin only)
router.get(
  "/users",
  requireRole("superadmin"),
  async (_req: Request, res: Response) => {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(users);
  },
);

// Update a user's role (superadmin only)
router.patch(
  "/users/:id/role",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      res.status(400).json({ error: "Geçersiz rol" });
      return;
    }

    // Superadmin cannot demote themselves
    const requestingUser = req.user as { id: string; role: UserRole };
    if (id === requestingUser.id && role !== "superadmin") {
      res.status(400).json({ error: "Kendi rolünüzü değiştiremezsiniz" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role: role as UserRole, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }

    res.json(updated);
  },
);

export default router;
