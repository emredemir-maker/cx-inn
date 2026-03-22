import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, invitationsTable, tenantMembershipsTable, tenantsTable, sessionsTable, type Invitation } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  getSession,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import type { UserRole } from "@workspace/db";

const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "";

const router: IRouter = Router();

const IS_PROD = process.env.NODE_ENV === "production";

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: IS_PROD,
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

  const isSuperadmin = !!SUPERADMIN_EMAIL && decoded.email === SUPERADMIN_EMAIL;

  const baseData = {
    id: decoded.uid,
    email: decoded.email ?? null,
    firstName,
    lastName,
    profileImageUrl: decoded.picture ?? null,
  };

  // Check for a pending invitation by email
  let invitedRole: UserRole | null = null;
  let acceptedInvite: Invitation | null = null;
  if (decoded.email && !isSuperadmin) {
    const [invite] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.email, decoded.email.toLowerCase()));

    if (invite && !invite.accepted) {
      invitedRole = invite.role as UserRole;
      acceptedInvite = invite;
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

  // ── Create tenant_membership if invitation has a tenantId ─────────────────
  if (acceptedInvite?.tenantId) {
    const tenantRole =
      invitedRole === "cx_manager" ? "cx_manager"
      : invitedRole === "superadmin" ? "tenant_admin"
      : "cx_user";
    await db
      .insert(tenantMembershipsTable)
      .values({
        tenantId: acceptedInvite.tenantId,
        userId: user.id,
        role: tenantRole,
      })
      .onConflictDoNothing();
  }

  // ── Ensure every user has at least a membership in the default tenant ──────
  await db
    .insert(tenantMembershipsTable)
    .values({
      tenantId: DEFAULT_TENANT_ID,
      userId: user.id,
      role: isSuperadmin ? "tenant_admin" : (invitedRole === "cx_manager" ? "cx_manager" : "cx_user"),
    })
    .onConflictDoNothing();

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

  // ── Query tenant memberships ───────────────────────────────────────────────
  const memberships = await db
    .select({
      tenantId: tenantMembershipsTable.tenantId,
      role: tenantMembershipsTable.role,
      name: tenantsTable.name,
      slug: tenantsTable.slug,
      logoUrl: tenantsTable.logoUrl,
      primaryColor: tenantsTable.primaryColor,
      isActive: tenantsTable.isActive,
    })
    .from(tenantMembershipsTable)
    .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
    .where(eq(tenantMembershipsTable.userId, dbUser.id));

  // Active tenants only — filter after join
  const activeTenants = memberships.filter((m) => m.isActive);

  // Auto-select: single tenant → embed in session; multiple → require picker
  const requiresTenantPicker = activeTenants.length > 1;
  const autoTenant = activeTenants.length === 1 ? activeTenants[0] : null;

  const sessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    profileImageUrl: dbUser.profileImageUrl,
    role: dbUser.role as UserRole,
  };

  const sessionData: SessionData = {
    user: sessionUser,
    tenantId: autoTenant?.tenantId ?? null,
    tenantRole: autoTenant?.role ?? null,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({
    user: sessionUser,
    tenants: activeTenants.map((m) => ({
      id: m.tenantId,
      name: m.name,
      slug: m.slug,
      logoUrl: m.logoUrl,
      primaryColor: m.primaryColor,
      role: m.role,
    })),
    requiresTenantPicker,
    currentTenantId: autoTenant?.tenantId ?? null,
  });
});

// ── GET /auth/tenant-info — current tenant context ────────────────────────────
router.get("/auth/tenant-info", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli" });
    return;
  }

  const memberships = await db
    .select({
      tenantId: tenantMembershipsTable.tenantId,
      role: tenantMembershipsTable.role,
      name: tenantsTable.name,
      slug: tenantsTable.slug,
      logoUrl: tenantsTable.logoUrl,
      primaryColor: tenantsTable.primaryColor,
      isActive: tenantsTable.isActive,
    })
    .from(tenantMembershipsTable)
    .innerJoin(tenantsTable, eq(tenantMembershipsTable.tenantId, tenantsTable.id))
    .where(eq(tenantMembershipsTable.userId, req.user!.id));

  const activeTenants = memberships.filter((m) => m.isActive);

  res.json({
    currentTenantId: req.tenantId ?? null,
    currentTenantRole: req.tenantRole ?? null,
    tenants: activeTenants.map((m) => ({
      id: m.tenantId,
      name: m.name,
      slug: m.slug,
      logoUrl: m.logoUrl,
      primaryColor: m.primaryColor,
      role: m.role,
    })),
  });
});

// ── POST /auth/switch-tenant — switch active tenant ───────────────────────────
router.post("/auth/switch-tenant", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Kimlik doğrulama gerekli" });
    return;
  }

  const { tenantId } = req.body as { tenantId?: string };
  if (!tenantId) {
    res.status(400).json({ error: "tenantId zorunludur" });
    return;
  }

  // Verify user has access to the requested tenant
  const [membership] = await db
    .select()
    .from(tenantMembershipsTable)
    .where(
      and(
        eq(tenantMembershipsTable.tenantId, tenantId),
        eq(tenantMembershipsTable.userId, req.user!.id),
      ),
    );

  if (!membership) {
    res.status(403).json({ error: "Bu tenant'a erişim yetkiniz yok" });
    return;
  }

  // Patch the session record directly with the new tenant context
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const updated: SessionData = {
        ...session,
        tenantId: membership.tenantId,
        tenantRole: membership.role,
      };
      await db
        .update(sessionsTable)
        .set({ sess: updated as unknown as Record<string, unknown> })
        .where(eq(sessionsTable.sid, sid));
    }
  }

  res.json({
    tenantId: membership.tenantId,
    tenantRole: membership.role,
  });
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
