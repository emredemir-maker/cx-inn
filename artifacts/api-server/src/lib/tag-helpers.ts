import { db } from "@workspace/db";
import { tagSynonymsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Shared tag normalization helpers.
 *
 * Single source of truth — imported by:
 *   - services/cx-analysis.service.ts  (new analysis runs)
 *   - lib/analyze.ts                    (legacy analyzeCustomer path)
 *   - routes/tag-taxonomy.ts            (normalize-all endpoint)
 *
 * Keeping this in one place ensures that all three paths apply the
 * same synonym → canonical substitution logic.
 */

/**
 * Build a lowercase-synonym → canonicalName map from the DB, scoped to a tenant.
 * Returns an empty map when tenantId is not provided to prevent cross-tenant
 * vocabulary leakage.
 */
export async function buildSynonymMap(
  tenantId?: string | null,
): Promise<Map<string, string>> {
  // When tenantId is not provided, return an empty map rather than returning all-tenant
  // data — avoids cross-tenant vocabulary leakage.
  if (!tenantId) return new Map<string, string>();
  const groups = await db.select().from(tagSynonymsTable).where(eq(tagSynonymsTable.tenantId, tenantId));

  const map = new Map<string, string>();
  for (const group of groups) {
    for (const syn of group.synonyms) {
      map.set(syn.toLowerCase(), group.canonicalName);
    }
  }
  return map;
}

/**
 * Replace each tag with its canonical form (case-insensitive lookup).
 * Deduplicates the result.
 */
export function normalizeTags(
  tags: string[],
  synonymMap: Map<string, string>,
): string[] {
  return Array.from(
    new Set(tags.map((t) => synonymMap.get(t.toLowerCase()) ?? t)),
  );
}
