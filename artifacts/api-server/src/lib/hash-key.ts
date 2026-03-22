import { createHash } from "crypto";

/**
 * Shared API-key hashing utility.
 * Both api-key-auth middleware and the key-management routes must use
 * the same algorithm — centralised here to avoid drift.
 */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
