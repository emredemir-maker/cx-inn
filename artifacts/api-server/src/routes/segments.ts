import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { segmentsTable, customersTable, interactionRecordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/requireRole";
import { sanitizeError } from "../lib/sanitize-error";
import { computeSegmentStats } from "../services/segment.service";

const router: IRouter = Router();

// ─── List segments ────────────────────────────────────────────────────────────
router.get("/segments", requireAuth, async (_req, res) => {
  try {
    const segments = await db.select().from(segmentsTable).orderBy(segmentsTable.createdAt);
    res.json(segments.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Helper: Jaccard similarity between two tag arrays ────────────────────────
function computeJaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a.map(t => t.toLowerCase()));
  const setB = new Set(b.map(t => t.toLowerCase()));
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── AI Segment Suggestions ───────────────────────────────────────────────────
router.post("/segments/ai-suggest", requireAuth, async (_req, res) => {
  try {
    // 0) Fetch existing segments for duplicate detection
    const existingSegments = await db.select({ id: segmentsTable.id, name: segmentsTable.name, sourceTags: segmentsTable.sourceTags }).from(segmentsTable);

    // 1) Interaction tags
    const tagRows = await db.execute<{ t: string }>(sql`
      SELECT DISTINCT unnest(tags) as t
      FROM ${interactionRecordsTable}
      WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
      ORDER BY t
    `);
    const interactionTags = tagRows.rows.map((r) => r.t).filter(Boolean);

    // 2) Pain points and key topics from cx_analyses
    const allPainPoints = await db.execute<{ t: string }>(sql`
      SELECT DISTINCT unnest(pain_points) as t FROM ${cxAnalysesTable} WHERE pain_points IS NOT NULL ORDER BY t
    `);
    const allKeyTopics = await db.execute<{ t: string }>(sql`
      SELECT DISTINCT unnest(key_topics) as t FROM ${cxAnalysesTable} WHERE key_topics IS NOT NULL ORDER BY t
    `);
    const painPoints = allPainPoints.rows.map((r) => r.t).filter(Boolean);
    const keyTopics = allKeyTopics.rows.map((r) => r.t).filter(Boolean);

    // 3) NPS/CSAT prediction distribution from cx_analyses
    const npsCsatDist = await db.execute<{
      nps_band: string; csat_band: string; churn_risk: string; overall_sentiment: string; count: string;
    }>(sql`
      SELECT
        CASE
          WHEN predicted_nps >= 9 THEN 'promoter (9-10)'
          WHEN predicted_nps >= 7 THEN 'passive (7-8)'
          WHEN predicted_nps IS NOT NULL THEN 'detractor (0-6)'
          ELSE 'unknown'
        END as nps_band,
        CASE
          WHEN predicted_csat >= 4 THEN 'satisfied (4-5)'
          WHEN predicted_csat >= 3 THEN 'neutral (3)'
          WHEN predicted_csat IS NOT NULL THEN 'dissatisfied (1-2)'
          ELSE 'unknown'
        END as csat_band,
        churn_risk,
        overall_sentiment,
        COUNT(*)::text as count
      FROM ${cxAnalysesTable}
      GROUP BY nps_band, csat_band, churn_risk, overall_sentiment
      ORDER BY count DESC
    `);

    // 4) Ticket count distribution per customer
    const ticketStats = await db.execute<{ band: string; count: string }>(sql`
      SELECT
        CASE
          WHEN ticket_count >= 10 THEN 'yüksek hacimli (10+)'
          WHEN ticket_count >= 5  THEN 'orta hacimli (5-9)'
          WHEN ticket_count >= 2  THEN 'düşük hacimli (2-4)'
          ELSE 'tek etkileşim (1)'
        END as band,
        COUNT(*)::text as count
      FROM (
        SELECT customer_id, COUNT(*) as ticket_count
        FROM ${interactionRecordsTable}
        GROUP BY customer_id
      ) t
      GROUP BY band
      ORDER BY count DESC
    `);

    // 5) Avg predicted NPS/CSAT overall
    const avgStats = await db.execute<{ avg_nps: string; avg_csat: string; total: string }>(sql`
      SELECT
        ROUND(AVG(predicted_nps)::numeric, 1)::text as avg_nps,
        ROUND(AVG(predicted_csat)::numeric, 1)::text as avg_csat,
        COUNT(*)::text as total
      FROM ${cxAnalysesTable}
    `);

    const prompt = `Sen bir B2B SaaS CX (Müşteri Deneyimi) analist asistanısın.

Aşağıda gerçek müşteri verileri bulunuyor:

**Etkileşim Kayıt Etiketleri:**
${interactionTags.join(", ")}

**Ağrı Noktaları:**
${painPoints.join(", ")}

**Anahtar Konular:**
${keyTopics.join(", ")}

**NPS/CSAT Tahmin Dağılımı (cx_analyses tablosu):**
${npsCsatDist.rows.map(r => `- NPS: ${r.nps_band}, CSAT: ${r.csat_band}, Churn riski: ${r.churn_risk}, Duygu: ${r.overall_sentiment} → ${r.count} analiz`).join("\n")}

**Ticket/Talep Sayısı Dağılımı (müşteri başına):**
${ticketStats.rows.map(r => `- ${r.band}: ${r.count} müşteri`).join("\n")}

**Genel Ortalamalar:**
- Ortalama Tahmin NPS: ${avgStats.rows[0]?.avg_nps ?? "N/A"}
- Ortalama Tahmin CSAT: ${avgStats.rows[0]?.avg_csat ?? "N/A"}
- Toplam Analiz Edilen Etkileşim: ${avgStats.rows[0]?.total ?? "0"}

**MEVCUT SEGMENTLER (tekrar önerme, bunları atla):**
${existingSegments.map(s => `- ${s.name}: [${(s.sourceTags ?? []).join(', ')}]`).join('\n')}

Bu verilere dayanarak, bu B2B platformu için **5 adet anlamlı müşteri segmenti** öner. Segmentler:
- NPS/CSAT tahmin skorlarını dikkate almalı (örn: düşük NPS'li müşteriler = risk grubu)
- Churn riski bilgisini kullanmalı
- Ticket/talep yoğunluğuna göre gruplandırılabilir
- Ağrı noktaları ve etiketlerle desteklenmeli

Her segment için şunları belirle:
- name: Türkçe, kısa segment adı (max 4 kelime)
- description: Türkçe, bu segmentin kim olduğunu açıklayan 1-2 cümle (NPS/CSAT ve ticket bilgilerini içer)
- criteria: Bu segmenti tanımlayan metrik kriterleri (Türkçe, somut: "predicted_nps < 7 VE churn_risk = high" gibi)
- sourceTags: Bu segmentle ilgili yukarıdaki etiket listesinden seçilen etiketler (string array)
- actionRecommendation: Bu segment için önerilen CX aksiyonu (Türkçe, 1 cümle, somut ve ölçülü)
- estimatedSize: "küçük" | "orta" | "büyük" (verilerden tahmin)

Yanıtını SADECE geçerli JSON olarak döndür:
{ "segments": [ { "name": "...", "description": "...", "criteria": "...", "sourceTags": [...], "actionRecommendation": "...", "estimatedSize": "..." } ] }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.6 },
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw);

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      return res.status(500).json({ error: "Gemini geçersiz format döndürdü" });
    }

    // Estimate customer counts based on sourceTags (interactions with these tags)
    const suggestionsWithCounts = await Promise.all(
      parsed.segments.map(async (s: any) => {
        if (!s.sourceTags || s.sourceTags.length === 0) {
          const dupMatch = existingSegments.find(es => {
            const nameSimilar = es.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(es.name.toLowerCase());
            return nameSimilar;
          });
          return { ...s, estimatedCustomerCount: 0, isDuplicate: !!dupMatch, existingMatchName: dupMatch?.name };
        }
        const countResult = await db.execute<{ count: string }>(sql`
          SELECT COUNT(DISTINCT customer_id)::text as count
          FROM ${interactionRecordsTable}
          WHERE tags && ARRAY[${sql.join(s.sourceTags.map((t: string) => sql`${t}`), sql`, `)}]::text[]
        `);
        const estimatedCustomerCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
        const dupMatch = existingSegments.find(es => {
          const jaccard = computeJaccard(s.sourceTags ?? [], es.sourceTags ?? []);
          const nameSimilar = es.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(es.name.toLowerCase());
          return jaccard > 0.5 || nameSimilar;
        });
        return { ...s, estimatedCustomerCount, isDuplicate: !!dupMatch, existingMatchName: dupMatch?.name };
      })
    );

    res.json({ suggestions: suggestionsWithCounts });
  } catch (err) {
    console.error("AI segment suggest error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Create segment ───────────────────────────────────────────────────────────
router.post("/segments", requireAuth, async (req, res) => {
  try {
    const { name, description, criteria, sourceTags, aiGenerated } = req.body as {
      name: string;
      description: string;
      criteria: string;
      sourceTags?: string[];
      aiGenerated?: boolean;
    };

    const { customerCount, avgNps } = await computeSegmentStats(sourceTags);

    const [segment] = await db.insert(segmentsTable).values({
      name,
      description,
      criteria,
      sourceTags: sourceTags ?? null,
      aiGenerated: aiGenerated ?? false,
      customerCount,
      avgNps,
    }).returning();

    res.json(segment);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Update segment ───────────────────────────────────────────────────────────
router.put("/segments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, criteria, sourceTags } = req.body as {
      name?: string;
      description?: string;
      criteria?: string;
      sourceTags?: string[];
    };

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (criteria !== undefined) updates.criteria = criteria;
    if (sourceTags !== undefined) {
      updates.sourceTags = sourceTags;
      const stats = await computeSegmentStats(sourceTags);
      updates.customerCount = stats.customerCount;
      updates.avgNps = stats.avgNps;
    }

    const [updated] = await db.update(segmentsTable).set(updates).where(eq(segmentsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Delete segment ───────────────────────────────────────────────────────────
router.delete("/segments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(segmentsTable).where(eq(segmentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Refresh segment counts ───────────────────────────────────────────────────
router.post("/segments/:id/refresh", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [segment] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, id));
    if (!segment) return res.status(404).json({ error: "Segment bulunamadı" });

    const { customerCount, avgNps } = await computeSegmentStats(segment.sourceTags ?? []);

    const [updated] = await db.update(segmentsTable)
      .set({ customerCount, avgNps })
      .where(eq(segmentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ─── Detect customer segment transitions ──────────────────────────────────────
router.get("/segments/customer-transitions", requireAuth, async (_req, res) => {
  try {
    const segments = await db.select().from(segmentsTable);
    const activeSegments = segments.filter(s => s.sourceTags && s.sourceTags.length > 0);
    if (activeSegments.length === 0) return res.json({ transitions: [] });

    // Get customers with tags split into old (>30d) and recent (≤30d) periods
    const rows = await db.execute<{
      customer_id: number;
      customer_name: string;
      old_tags: string[];
      recent_tags: string[];
    }>(sql`
      SELECT
        c.id as customer_id,
        c.name as customer_name,
        COALESCE((
          SELECT array_agg(DISTINCT t)
          FROM ${interactionRecordsTable} ir, unnest(ir.tags) t
          WHERE ir.customer_id = c.id AND ir.tags IS NOT NULL
            AND ir.interacted_at < NOW() - INTERVAL '30 days'
        ), ARRAY[]::text[]) as old_tags,
        COALESCE((
          SELECT array_agg(DISTINCT t)
          FROM ${interactionRecordsTable} ir, unnest(ir.tags) t
          WHERE ir.customer_id = c.id AND ir.tags IS NOT NULL
            AND ir.interacted_at >= NOW() - INTERVAL '30 days'
        ), ARRAY[]::text[]) as recent_tags
      FROM ${customersTable} c
      WHERE EXISTS (
        SELECT 1 FROM ${interactionRecordsTable} ir
        WHERE ir.customer_id = c.id AND ir.interacted_at >= NOW() - INTERVAL '30 days'
          AND ir.tags IS NOT NULL AND array_length(ir.tags, 1) > 0
      )
      AND EXISTS (
        SELECT 1 FROM ${interactionRecordsTable} ir
        WHERE ir.customer_id = c.id AND ir.interacted_at < NOW() - INTERVAL '30 days'
          AND ir.tags IS NOT NULL AND array_length(ir.tags, 1) > 0
      )
    `);

    const findDominant = (tags: string[]) => {
      if (!tags || tags.length === 0) return null;
      let best: { id: number; name: string; overlap: number } | null = null;
      for (const seg of activeSegments) {
        const overlap = (seg.sourceTags ?? []).filter(t => tags.includes(t)).length;
        if (overlap > 0 && (!best || overlap > best.overlap)) {
          best = { id: seg.id, name: seg.name, overlap };
        }
      }
      return best;
    };

    const transitions = rows.rows
      .map(row => {
        const fromSeg = findDominant(row.old_tags);
        const toSeg = findDominant(row.recent_tags);
        if (!fromSeg || !toSeg || fromSeg.id === toSeg.id) return null;
        return {
          customerId: row.customer_id,
          customerName: row.customer_name,
          fromSegment: { id: fromSeg.id, name: fromSeg.name },
          toSegment: { id: toSeg.id, name: toSeg.name },
        };
      })
      .filter(Boolean);

    res.json({ transitions });
  } catch (err) {
    console.error("Segment transitions error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
