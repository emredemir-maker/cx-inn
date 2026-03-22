import { createHash } from "crypto";
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-api-key"] as string | undefined;
  if (!raw) {
    res.status(401).json({ error: "X-API-Key header eksik." });
    return;
  }
  try {
    const hash = hashKey(raw);
    const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, hash)).limit(1);
    if (!key || !key.isActive) {
      res.status(401).json({ error: "Geçersiz veya devre dışı API anahtarı." });
      return;
    }
    // Fire-and-forget lastUsedAt update — don't block the request on it
    db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id))
      .catch((err) => console.error("[apiKeyAuth] lastUsedAt update failed:", err));
    (req as any).apiKeyId = key.id;
    (req as any).apiKeyName = key.name;
    // Stamp tenantId from the API key so all v1 routes are automatically tenant-scoped
    (req as any).tenantId = key.tenantId;
    next();
  } catch (err) {
    console.error("[apiKeyAuth] DB error:", err);
    res.status(503).json({ error: "Kimlik doğrulama servisi geçici olarak kullanılamıyor." });
  }
}
