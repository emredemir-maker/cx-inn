import { type Request, type Response, type NextFunction } from "express";
import {
  clearSession,
  getSessionId,
  getSession,
} from "../lib/auth";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { UserRole } from "@workspace/db";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }
    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  // ── 1. Try session cookie (primary auth method) ──────────────────────────
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.user?.id) {
      const sessionUser = session.user as AuthUser;
      // Always fetch the latest role from DB so role changes take effect without re-login
      const [dbUser] = await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, sessionUser.id));
      sessionUser.role = (dbUser?.role ?? "cx_user") as UserRole;
      req.user = sessionUser;
      next();
      return;
    }
    // Session expired/invalid — clear the stale cookie
    clearSession(res);
  }

  // ── 2. Fall back to Firebase Bearer token (handles session cookie failures) ──
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await verifyFirebaseToken(idToken);
      const [dbUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, decoded.uid));
      if (dbUser) {
        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
          role: dbUser.role as UserRole,
        };
      }
    } catch {
      // Token invalid — continue without auth (requireRole will return 401)
    }
  }

  next();
}
