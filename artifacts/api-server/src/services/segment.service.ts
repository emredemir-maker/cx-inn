import { db } from "@workspace/db";
import { interactionRecordsTable, cxAnalysesTable, segmentsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Compute customer count and average NPS for a set of source tags.
 * Used by both the segments route and the CX analysis service.
 */
export async function computeSegmentStats(
  sourceTags?: string[] | null,
): Promise<{ customerCount: number; avgNps: number | null }> {
  if (!sourceTags || sourceTags.length === 0) {
    return { customerCount: 0, avgNps: null };
  }

  const countResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(DISTINCT customer_id)::text as count
    FROM ${interactionRecordsTable}
    WHERE tags && ARRAY[${sql.join(sourceTags.map((t) => sql`${t}`), sql`, `)}]::text[]
  `);
  const customerCount = parseInt(countResult.rows[0]?.count ?? "0", 10);

  const npsResult = await db.execute<{ avg_nps: string | null }>(sql`
    SELECT ROUND(AVG(predicted_nps)::numeric, 1)::text as avg_nps
    FROM ${cxAnalysesTable}
    WHERE customer_id IN (
      SELECT DISTINCT customer_id FROM ${interactionRecordsTable}
      WHERE tags && ARRAY[${sql.join(sourceTags.map((t) => sql`${t}`), sql`, `)}]::text[]
    )
    AND predicted_nps IS NOT NULL
  `);
  const rawAvg = npsResult.rows[0]?.avg_nps;
  const avgNps = rawAvg ? parseFloat(rawAvg) : null;

  return { customerCount, avgNps };
}

/**
 * Refresh the customerCount of any segment whose sourceTags overlap with
 * the provided tags. Called after interaction tags are updated by AI analysis.
 */
export async function refreshSegmentsForTags(newTags: string[]): Promise<void> {
  if (newTags.length === 0) return;
  try {
    const allSegments = await db
      .select({ id: segmentsTable.id, sourceTags: segmentsTable.sourceTags })
      .from(segmentsTable);

    for (const seg of allSegments) {
      if (!seg.sourceTags || seg.sourceTags.length === 0) continue;
      const overlaps = seg.sourceTags.some((t) => newTags.includes(t));
      if (!overlaps) continue;

      const countResult = await db.execute<{ count: string }>(sql`
        SELECT COUNT(DISTINCT customer_id)::text as count
        FROM ${interactionRecordsTable}
        WHERE tags && ARRAY[${sql.join(seg.sourceTags.map((t: string) => sql`${t}`), sql`, `)}]::text[]
      `);
      const customerCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
      await db.update(segmentsTable).set({ customerCount }).where(eq(segmentsTable.id, seg.id));
    }
  } catch (err) {
    console.error("[segment.service] refreshSegmentsForTags error:", err);
  }
}
