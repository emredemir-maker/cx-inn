import { type Request, type Response, type NextFunction } from "express";
import type { UserRole } from "@workspace/db";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli" });
    return;
  }
  next();
}
