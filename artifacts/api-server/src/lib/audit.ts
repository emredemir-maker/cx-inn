import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";

/**
 * Write a single audit log entry.
 * @param action  - Verb describing the operation (e.g. "CREATE", "CX_ANALYSIS")
 * @param entityType - Table / domain name (e.g. "interaction_records")
 * @param entityId   - Primary key of the affected row, or null for bulk ops
 * @param userId     - ID of the authenticated user; falls back to "system"
 * @param details    - Human-readable description (no raw PII unless piiMasked=true)
 * @param piiMasked  - Whether PII has been stripped from `details`
 */
export async function writeAuditLog(
  action: string,
  entityType: string,
  entityId: number | null,
  userId: string,
  details: string,
  piiMasked = false,
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action,
      entityType,
      entityId,
      userId,
      details,
      piiMasked,
    });
  } catch (err) {
    // Audit failures must never break the primary operation
    console.error("[audit] Failed to write audit log:", err);
  }
}

/** Extract the user ID from an Express request's user object. */
export function getUserId(user: Express.Request["user"]): string {
  return (user as { id?: string } | undefined)?.id ?? "system";
}
