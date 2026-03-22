import { type Request, type Response, type NextFunction } from "express";
import { db, tenantMembershipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_TENANT_ID } from "../lib/constants";

/**
 * tenantContextMiddleware
 *
 * Runs after authMiddleware. If the authenticated user does not yet have a
 * tenantId attached to their request (i.e. the session pre-dates multi-tenancy
 * or the user is accessing a route without switching), this middleware
 * auto-resolves the tenant:
 *   - Single membership → auto-select that tenant
 *   - Multiple memberships → leave tenantId as null (frontend must call switch-tenant)
 *   - Superadmin with no membership → fall back to default tenant (in-memory, no DB record)
 *
 * Routes that require a valid tenant must guard with:
 *   if (!req.tenantId) return res.status(400).json({ error: "Aktif tenant seçili değil" });
 */
export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Already resolved (from session) or not authenticated — nothing to do
  if (req.tenantId || !req.user) {
    next();
    return;
  }

  try {
    const memberships = await db
      .select()
      .from(tenantMembershipsTable)
      .where(eq(tenantMembershipsTable.userId, req.user.id));

    if (memberships.length === 1) {
      req.tenantId = memberships[0].tenantId;
      req.tenantRole = memberships[0].role;
    } else if (memberships.length === 0 && req.user.role === "superadmin") {
      // Superadmin with no explicit membership falls back to the default tenant
      req.tenantId = DEFAULT_TENANT_ID;
      req.tenantRole = "tenant_admin";
    }
    // For users with >1 membership: tenantId stays null until they pick one
  } catch (err) {
    console.error("[tenantContext] Error resolving tenant:", err);
    // Non-fatal — proceed without tenant context
  }

  next();
}
