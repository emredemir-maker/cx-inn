import { Router } from "express";
import { db } from "@workspace/db";
import { companySettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router = Router();

// GET /api/settings/company
router.get("/settings/company", requireAuth, async (_req, res) => {
  try {
    const [settings] = await db.select().from(companySettingsTable).limit(1);
    if (!settings) {
      const [created] = await db.insert(companySettingsTable).values({}).returning();
      return res.json(created);
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// PUT /api/settings/company
router.put("/settings/company", requireAuth, async (req, res) => {
  try {
    const { companyName, logoUrl, primaryColor, email, website, industry, description } = req.body as {
      companyName?: string;
      logoUrl?: string;
      primaryColor?: string;
      email?: string;
      website?: string;
      industry?: string;
      description?: string;
    };

    const [existing] = await db.select().from(companySettingsTable).limit(1);

    if (!existing) {
      const [created] = await db.insert(companySettingsTable).values({
        companyName: companyName ?? "CX-Inn",
        logoUrl: logoUrl ?? null,
        primaryColor: primaryColor ?? "#6366f1",
        email: email ?? null,
        website: website ?? null,
        industry: industry ?? null,
        description: description ?? null,
        updatedAt: new Date(),
      }).returning();
      return res.json(created);
    }

    const [updated] = await db.update(companySettingsTable)
      .set({
        ...(companyName !== undefined && { companyName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(email !== undefined && { email }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      })
      .where(eq(companySettingsTable.id, existing.id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
