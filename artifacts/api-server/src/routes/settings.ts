import { Router } from "express";
import { db } from "@workspace/db";
import { companySettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireTenantRole } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";
import { DEFAULT_TENANT_ID, HEX_COLOR_RE } from "../lib/constants";

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

      // Validate logoUrl — must be a safe http/https URL or empty
      if (logoUrl !== undefined && logoUrl !== "" && logoUrl !== null) {
        try {
          const u = new URL(logoUrl);
          if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        } catch {
          res.status(400).json({ error: "logoUrl geçerli bir https/http URL'si olmalıdır" });
          return;
        }
      }
      // Validate primaryColor — must be a 6-digit hex color
      if (primaryColor !== undefined && primaryColor !== "" && !HEX_COLOR_RE.test(primaryColor)) {
        res.status(400).json({ error: "primaryColor #rrggbb formatında olmalıdır (örn: #6366f1)" });
        return;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (companyName !== undefined) patch.companyName = companyName;
      if (logoUrl !== undefined) patch.logoUrl = logoUrl || null;
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
