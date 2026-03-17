import { type Request, type Response, type NextFunction } from "express";
import {
  clearSession,
  getSessionId,
  getSession,
} from "../lib/auth";
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

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    clearSession(res);
    next();
    return;
  }

  const sessionUser = session.user as AuthUser;

  // Always fetch the latest role from DB so role changes take effect without re-login
  const [dbUser] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, sessionUser.id));
  sessionUser.role = (dbUser?.role ?? "cx_user") as UserRole;

  req.user = sessionUser;
  next();
}
