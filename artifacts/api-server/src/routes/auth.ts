import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, invitationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import type { UserRole } from "@workspace/db";

const SUPERADMIN_EMAIL = "emre.demir@infoset.app";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

async function upsertUser(decoded: {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}) {
  const nameParts = (decoded.name ?? "").trim().split(" ");
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  const isSuperadmin = decoded.email === SUPERADMIN_EMAIL;

  const baseData = {
    id: decoded.uid,
    email: decoded.email ?? null,
    firstName,
    lastName,
    profileImageUrl: decoded.picture ?? null,
  };

  // Check for a pending invitation by email
  let invitedRole: UserRole | null = null;
  if (decoded.email && !isSuperadmin) {
    const [invite] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.email, decoded.email.toLowerCase()));

    if (invite && !invite.accepted) {
      invitedRole = invite.role as UserRole;
      // Mark invitation as accepted
      await db
        .update(invitationsTable)
        .set({ accepted: true, acceptedAt: new Date() })
        .where(eq(invitationsTable.id, invite.id));
    }
  }

  const assignedRole: UserRole = isSuperadmin
    ? "superadmin"
    : (invitedRole ?? "cx_user");

  const [user] = await db
    .insert(usersTable)
    .values({ ...baseData, role: assignedRole })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...baseData,
        // Always enforce superadmin role for designated email
        ...(isSuperadmin ? { role: "superadmin" as UserRole } : {}),
        // Apply invited role only if this is a new sign-in with invitation
        ...(invitedRole && !isSuperadmin ? { role: invitedRole } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json({ user: req.isAuthenticated() ? req.user : null });
});

router.post("/auth/firebase-login", async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: "idToken required" });
    return;
  }

  let decoded;
  try {
    decoded = await verifyFirebaseToken(idToken);
  } catch (err) {
    console.error("Firebase token verification failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const dbUser = await upsertUser({
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    picture: decoded.picture,
  });

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      role: dbUser.role as UserRole,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ user: sessionData.user });
});

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  clearSession(res);
  res.json({ success: true });
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  clearSession(res);
  res.redirect("/");
});

export default router;
