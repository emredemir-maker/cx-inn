import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { UserRole } from "@workspace/db";

// Firebase Hosting only forwards cookies named "__session" to Cloud Run backends.
// All other cookie names are stripped before the request reaches the API server.
// See: https://firebase.google.com/docs/hosting/manage-cache#using_cookies
export const SESSION_COOKIE = "__session";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
}

export interface SessionData {
  user: SessionUser;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE];
}
