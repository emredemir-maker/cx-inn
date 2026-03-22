import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";
import { requireTenantRole } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";

const router = Router();

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function generateKey() {
  const raw = "cxinn_sk_" + randomBytes(24).toString("hex");
  const prefix = raw.slice(0, 17) + "...";
  const hash = hashKey(raw);
  return { raw, prefix, hash };
}

// GET /api/settings/api-keys — tenant-scoped
router.get("/settings/api-keys", requireTenantRole("tenant_admin"), async (req, res) => {
  try {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const keys = await db
      .select({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        isActive: apiKeysTable.isActive,
        createdAt: apiKeysTable.createdAt,
        lastUsedAt: apiKeysTable.lastUsedAt,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.tenantId, tenantId))
      .orderBy(apiKeysTable.createdAt);
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// POST /api/settings/api-keys — tenant-scoped
router.post("/settings/api-keys", requireTenantRole("tenant_admin"), async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return res.status(400).json({ error: "Ad zorunlu." });
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const { raw, prefix, hash } = generateKey();
    const [created] = await db.insert(apiKeysTable).values({
      name: name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      tenantId,
    }).returning();
    // Return full key ONCE — never stored in plain text
    res.json({ ...created, fullKey: raw });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// DELETE /api/settings/api-keys/:id — tenant-scoped
router.delete("/settings/api-keys/:id", requireTenantRole("tenant_admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    await db
      .delete(apiKeysTable)
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.tenantId, tenantId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// PATCH /api/settings/api-keys/:id/toggle — tenant-scoped
router.patch("/settings/api-keys/:id/toggle", requireTenantRole("tenant_admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const [key] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.tenantId, tenantId)))
      .limit(1);
    if (!key) return res.status(404).json({ error: "Bulunamadı." });
    const [updated] = await db
      .update(apiKeysTable)
      .set({ isActive: !key.isActive })
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.tenantId, tenantId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
