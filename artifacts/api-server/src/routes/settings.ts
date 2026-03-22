import { Router } from "express";
import { db } from "@workspace/db";
import { companySettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireTenantRole } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const router = Router();

// ── GET /api/settings/company — readable by all tenant members ────────────────
router.get("/settings/company", requireAuth, async (req, res) => {
  try {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;

    const [settings] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.tenantId, tenantId))
      .limit(1);

    if (!settings) {
      // Auto-create default settings for this tenant on first access
      const [created] = await db
        .insert(companySettingsTable)
        .values({ tenantId })
        .returning();
      return res.json(created);
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── PUT /api/settings/company — writable by tenant_admin and superadmin ────────
router.put(
  "/settings/company",
  requireTenantRole("tenant_admin"),
  async (req, res) => {
    try {
      const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;

      const {
        companyName,
        logoUrl,
        primaryColor,
        email,
        website,
        industry,
        description,
      } = req.body as {
        companyName?: string;
        logoUrl?: string;
        primaryColor?: string;
        email?: string;
        website?: string;
        industry?: string;
        description?: string;
      };

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (companyName !== undefined) patch.companyName = companyName;
      if (logoUrl !== undefined) patch.logoUrl = logoUrl;
      if (primaryColor !== undefined) patch.primaryColor = primaryColor;
      if (email !== undefined) patch.email = email;
      if (website !== undefined) patch.website = website;
      if (industry !== undefined) patch.industry = industry;
      if (description !== undefined) patch.description = description;

      const [existing] = await db
        .select()
        .from(companySettingsTable)
        .where(eq(companySettingsTable.tenantId, tenantId))
        .limit(1);

      if (!existing) {
        const [created] = await db
          .insert(companySettingsTable)
          .values({
            tenantId,
            companyName: (companyName as string | undefined) ?? "CX-Inn",
            logoUrl: logoUrl ?? null,
            primaryColor: primaryColor ?? "#6366f1",
            email: email ?? null,
            website: website ?? null,
            industry: industry ?? null,
            description: description ?? null,
          })
          .returning();
        return res.json(created);
      }

      const [updated] = await db
        .update(companySettingsTable)
        .set(patch)
        .where(eq(companySettingsTable.id, existing.id))
        .returning();

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: sanitizeError(err) });
    }
  },
);

export default router;
