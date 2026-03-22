import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tenantsTable,
  tenantMembershipsTable,
  usersTable,
  invitationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireRole, requireTenantRole } from "../middleware/requireRole";

const router: IRouter = Router();

// ── GET /platform/tenants — list all tenants ──────────────────────────────────
router.get(
  "/platform/tenants",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    try {
      const tenants = await db
        .select()
        .from(tenantsTable)
        .orderBy(tenantsTable.createdAt);
      res.json({ tenants });
    } catch (err) {
      console.error("[platform] GET /tenants error:", err);
      res.status(500).json({ error: "Tenant listesi alınamadı" });
    }
  },
);

// ── POST /platform/tenants — create new tenant ────────────────────────────────
router.post(
  "/platform/tenants",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const {
      name,
      slug,
      email,
      website,
      industry,
      description,
      plan,
      primaryColor,
      logoUrl,
    } = req.body as {
      name?: string;
      slug?: string;
      email?: string;
      website?: string;
      industry?: string;
      description?: string;
      plan?: string;
      primaryColor?: string;
      logoUrl?: string;
    };

    if (!name?.trim() || !slug?.trim()) {
      res.status(400).json({ error: "name ve slug zorunludur" });
      return;
    }

    const cleanSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      res.status(400).json({
        error: "slug yalnızca küçük harf, rakam ve tire (-) içerebilir",
      });
      return;
    }

    const validPlans = ["standard", "professional", "enterprise"] as const;
    const safePlan = validPlans.includes(plan as (typeof validPlans)[number])
      ? (plan as (typeof validPlans)[number])
      : "standard";

    try {
      const [tenant] = await db
        .insert(tenantsTable)
        .values({
          name: name.trim(),
          slug: cleanSlug,
          email: email?.trim() ?? null,
          website: website?.trim() ?? null,
          industry: industry?.trim() ?? null,
          description: description?.trim() ?? null,
          plan: safePlan,
          primaryColor: primaryColor ?? "#6366f1",
          logoUrl: logoUrl?.trim() ?? null,
        })
        .returning();

      res.status(201).json({ tenant });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        res.status(409).json({ error: "Bu slug zaten başka bir tenant tarafından kullanılıyor" });
        return;
      }
      console.error("[platform] POST /tenants error:", err);
      res.status(500).json({ error: "Tenant oluşturulamadı" });
    }
  },
);

// ── PUT /platform/tenants/:id — update tenant ─────────────────────────────────
router.put(
  "/platform/tenants/:id",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      name,
      slug,
      email,
      website,
      industry,
      description,
      plan,
      primaryColor,
      logoUrl,
      isActive,
    } = req.body as {
      name?: string;
      slug?: string;
      email?: string;
      website?: string;
      industry?: string;
      description?: string;
      plan?: string;
      primaryColor?: string;
      logoUrl?: string;
      isActive?: boolean;
    };

    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
        res.status(400).json({
          error: "slug yalnızca küçük harf, rakam ve tire (-) içerebilir",
        });
        return;
      }
    }

    // Build update payload with only defined fields
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) updates.slug = slug.trim().toLowerCase();
    if (email !== undefined) updates.email = email.trim() || null;
    if (website !== undefined) updates.website = website.trim() || null;
    if (industry !== undefined) updates.industry = industry.trim() || null;
    if (description !== undefined) updates.description = description.trim() || null;
    if (plan !== undefined) updates.plan = plan;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;

    try {
      const [tenant] = await db
        .update(tenantsTable)
        .set(updates)
        .where(eq(tenantsTable.id, id))
        .returning();

      if (!tenant) {
        res.status(404).json({ error: "Tenant bulunamadı" });
        return;
      }
      res.json({ tenant });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        res.status(409).json({ error: "Bu slug zaten kullanımda" });
        return;
      }
      console.error("[platform] PUT /tenants/:id error:", err);
      res.status(500).json({ error: "Tenant güncellenemedi" });
    }
  },
);

// ── GET /platform/tenants/:id/members ─────────────────────────────────────────
router.get(
  "/platform/tenants/:id/members",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const members = await db
        .select({
          membershipId: tenantMembershipsTable.id,
          userId: tenantMembershipsTable.userId,
          role: tenantMembershipsTable.role,
          joinedAt: tenantMembershipsTable.createdAt,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          profileImageUrl: usersTable.profileImageUrl,
        })
        .from(tenantMembershipsTable)
        .innerJoin(usersTable, eq(tenantMembershipsTable.userId, usersTable.id))
        .where(eq(tenantMembershipsTable.tenantId, id));

      res.json({ members });
    } catch (err) {
      console.error("[platform] GET /tenants/:id/members error:", err);
      res.status(500).json({ error: "Üye listesi alınamadı" });
    }
  },
);

// ── POST /platform/tenants/:id/invite — invite user to tenant ─────────────────
router.post(
  "/platform/tenants/:id/invite",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, role } = req.body as { email?: string; role?: string };

    if (!email?.trim() || !role) {
      res.status(400).json({ error: "email ve role zorunludur" });
      return;
    }

    const validTenantRoles = ["tenant_admin", "cx_manager", "cx_user"];
    if (!validTenantRoles.includes(role)) {
      res.status(400).json({
        error: `Geçersiz rol. Geçerli değerler: ${validTenantRoles.join(", ")}`,
      });
      return;
    }

    // Store the exact intended role in the invitation — no silent downgrade
    const invitationRole = role as "tenant_admin" | "cx_manager" | "cx_user";

    try {
      // Verify tenant exists
      const [tenant] = await db
        .select({ id: tenantsTable.id, name: tenantsTable.name })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, id));

      if (!tenant) {
        res.status(404).json({ error: "Tenant bulunamadı" });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const [invitation] = await db
        .insert(invitationsTable)
        .values({
          email: normalizedEmail,
          role: invitationRole,
          tenantId: id,
          invitedBy: req.user!.id,
        })
        .onConflictDoUpdate({
          // Conflict on (email, tenantId) — same user re-invited to the same tenant
          target: [invitationsTable.email, invitationsTable.tenantId],
          set: {
            role: invitationRole,
            invitedBy: req.user!.id,
            accepted: false,
            acceptedAt: null,
          },
        })
        .returning();

      res.status(201).json({
        invitation,
        message: `${normalizedEmail} adresine ${tenant.name} tenant'ına davet gönderildi`,
      });
    } catch (err) {
      console.error("[platform] POST /tenants/:id/invite error:", err);
      res.status(500).json({ error: "Davet oluşturulamadı" });
    }
  },
);

// ── DELETE /platform/tenants/:id/members/:userId — remove member ──────────────
router.delete(
  "/platform/tenants/:id/members/:userId",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id, userId } = req.params;

    // Prevent removing yourself from your own tenant
    if (userId === req.user!.id) {
      res.status(400).json({ error: "Kendinizi tenant'tan çıkaramazsınız" });
      return;
    }

    try {
      await db
        .delete(tenantMembershipsTable)
        .where(
          and(
            eq(tenantMembershipsTable.tenantId, id),
            eq(tenantMembershipsTable.userId, userId),
          ),
        );

      res.json({ success: true });
    } catch (err) {
      console.error("[platform] DELETE /tenants/:id/members/:userId error:", err);
      res.status(500).json({ error: "Üye kaldırılamadı" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// tenant_admin — "my tenant" self-service routes
// These use req.tenantId (active tenant from session) instead of a URL param.
// Accessible by tenant_admin of the current tenant, and by superadmin.
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /platform/my-tenant — view own tenant info ────────────────────────────
router.get(
  "/platform/my-tenant",
  requireTenantRole("tenant_admin"),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Aktif tenant seçili değil" });
      return;
    }
    try {
      const [tenant] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId));
      if (!tenant) {
        res.status(404).json({ error: "Tenant bulunamadı" });
        return;
      }
      res.json({ tenant });
    } catch (err) {
      console.error("[platform] GET /my-tenant error:", err);
      res.status(500).json({ error: "Tenant bilgisi alınamadı" });
    }
  },
);

// ── GET /platform/my-tenant/members — list own tenant members ─────────────────
router.get(
  "/platform/my-tenant/members",
  requireTenantRole("tenant_admin"),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Aktif tenant seçili değil" });
      return;
    }
    try {
      const members = await db
        .select({
          membershipId: tenantMembershipsTable.id,
          userId: tenantMembershipsTable.userId,
          role: tenantMembershipsTable.role,
          joinedAt: tenantMembershipsTable.createdAt,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          profileImageUrl: usersTable.profileImageUrl,
        })
        .from(tenantMembershipsTable)
        .innerJoin(usersTable, eq(tenantMembershipsTable.userId, usersTable.id))
        .where(eq(tenantMembershipsTable.tenantId, tenantId));
      res.json({ members });
    } catch (err) {
      console.error("[platform] GET /my-tenant/members error:", err);
      res.status(500).json({ error: "Üye listesi alınamadı" });
    }
  },
);

// ── POST /platform/my-tenant/invite — invite user to own tenant ───────────────
router.post(
  "/platform/my-tenant/invite",
  requireTenantRole("tenant_admin"),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Aktif tenant seçili değil" });
      return;
    }

    const { email, role } = req.body as { email?: string; role?: string };
    if (!email?.trim() || !role) {
      res.status(400).json({ error: "email ve role zorunludur" });
      return;
    }

    // tenant_admin can only invite cx_manager and cx_user (not another tenant_admin)
    const allowed = ["cx_manager", "cx_user"];
    if (!allowed.includes(role)) {
      res.status(400).json({ error: "Tenant admin yalnızca cx_manager ve cx_user davet edebilir" });
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const invitationRole = role as "cx_manager" | "cx_user";

      const [invitation] = await db
        .insert(invitationsTable)
        .values({
          email: normalizedEmail,
          role: invitationRole,
          tenantId,
          invitedBy: req.user!.id,
        })
        .onConflictDoUpdate({
          // Conflict on (email, tenantId) — same user re-invited to the same tenant
          target: [invitationsTable.email, invitationsTable.tenantId],
          set: {
            role: invitationRole,
            invitedBy: req.user!.id,
            accepted: false,
            acceptedAt: null,
          },
        })
        .returning();

      res.status(201).json({ invitation });
    } catch (err) {
      console.error("[platform] POST /my-tenant/invite error:", err);
      res.status(500).json({ error: "Davet oluşturulamadı" });
    }
  },
);

// ── DELETE /platform/my-tenant/members/:userId — remove member from own tenant ─
router.delete(
  "/platform/my-tenant/members/:userId",
  requireTenantRole("tenant_admin"),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    const { userId } = req.params;

    if (!tenantId) {
      res.status(400).json({ error: "Aktif tenant seçili değil" });
      return;
    }
    if (userId === req.user!.id) {
      res.status(400).json({ error: "Kendinizi tenant'tan çıkaramazsınız" });
      return;
    }

    try {
      await db
        .delete(tenantMembershipsTable)
        .where(
          and(
            eq(tenantMembershipsTable.tenantId, tenantId),
            eq(tenantMembershipsTable.userId, userId),
          ),
        );
      res.json({ success: true });
    } catch (err) {
      console.error("[platform] DELETE /my-tenant/members/:userId error:", err);
      res.status(500).json({ error: "Üye kaldırılamadı" });
    }
  },
);

export default router;
