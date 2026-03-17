import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

// GET /api/settings/api-keys
router.get("/settings/api-keys", async (_req, res) => {
  try {
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
      .orderBy(apiKeysTable.createdAt);
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/settings/api-keys
router.post("/settings/api-keys", async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return res.status(400).json({ error: "Ad zorunlu." });
    const { raw, prefix, hash } = generateKey();
    const [created] = await db.insert(apiKeysTable).values({
      name: name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
    }).returning();
    // Return full key ONCE — never stored in plain text
    res.json({ ...created, fullKey: raw });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/settings/api-keys/:id
router.delete("/settings/api-keys/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/settings/api-keys/:id/toggle
router.patch("/settings/api-keys/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)).limit(1);
    if (!key) return res.status(404).json({ error: "Bulunamadı." });
    const [updated] = await db.update(apiKeysTable).set({ isActive: !key.isActive }).where(eq(apiKeysTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
