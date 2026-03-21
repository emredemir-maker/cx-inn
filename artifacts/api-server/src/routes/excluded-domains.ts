import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { excludedDomainsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router: IRouter = Router();

// ─── List all excluded domains ────────────────────────────────────────────────
router.get("/excluded-domains", requireAuth, async (_req, res) => {
  try {
    const domains = await db
      .select()
      .from(excludedDomainsTable)
      .orderBy(asc(excludedDomainsTable.createdAt));
    res.json(domains);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Add a domain ─────────────────────────────────────────────────────────────
router.post("/excluded-domains", requireAuth, async (req, res) => {
  const { domain, reason, source } = req.body as {
    domain: string;
    reason?: string;
    source?: "manual" | "auto";
  };

  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "domain zorunludur." });
  }

  // Normalise: lowercase, strip leading "@" or "*."
  const normalised = domain.toLowerCase().replace(/^[@*.]*/g, "").trim();
  if (!normalised || !normalised.includes(".")) {
    return res.status(400).json({ error: "Geçersiz domain formatı (örn: infoset.app)" });
  }

  try {
    const [created] = await db
      .insert(excludedDomainsTable)
      .values({ domain: normalised, reason: reason ?? null, source: source ?? "manual" })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      // Already exists — return the existing row
      const [existing] = await db
        .select()
        .from(excludedDomainsTable)
        .where(eq(excludedDomainsTable.domain, normalised));
      return res.json(existing);
    }
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Delete a domain ──────────────────────────────────────────────────────────
router.delete("/excluded-domains/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Geçersiz ID" });

  try {
    await db.delete(excludedDomainsTable).where(eq(excludedDomainsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
