import { type Request, type Response, type NextFunction } from "express";
import type { UserRole } from "@workspace/db";

export type TenantRole = "tenant_admin" | "cx_manager" | "cx_user";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Kimlik doğrulama gerekli" });
      return;
    }
    const userRole = (req.user as { role?: UserRole })?.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
      return;
    }
    next();
  };
}

/**
 * requireTenantRole — checks the user's role within the active tenant.
 * Superadmin always passes regardless of tenant role.
 */
export function requireTenantRole(...roles: TenantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Kimlik doğrulama gerekli" });
      return;
    }
    // Platform superadmin bypasses tenant role restrictions
    const globalRole = (req.user as { role?: string })?.role;
    if (globalRole === "superadmin") {
      next();
      return;
    }
    const tenantRole = req.tenantRole as TenantRole | null | undefined;
    if (!tenantRole || !roles.includes(tenantRole)) {
      res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
      return;
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli" });
    return;
  }
  next();
}
