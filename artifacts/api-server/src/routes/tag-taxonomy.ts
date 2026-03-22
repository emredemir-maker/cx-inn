import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tagSynonymsTable, interactionRecordsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth, requireTenantRole } from "../middleware/requireRole";
import { buildSynonymMap, normalizeTags } from "../lib/tag-helpers";
import { refreshSegmentsForTags } from "../services/segment.service";

const router: IRouter = Router();

// ─── Auth: all routes require a logged-in user; write routes require manager+ ─
//     GET endpoints: requireAuth
//     mutating endpoints (POST/PUT/DELETE): requireTenantRole — tenant_admin or cx_manager
//     (superadmin is always allowed through requireTenantRole)
const requireManager = requireTenantRole("tenant_admin", "cx_manager");

// ─── Tenant guard helper ──────────────────────────────────────────────────────
function getTenantId(req: any): string | null {
  return req.tenantId ?? null;
}

// ─── GET all tag synonym groups (tenant-scoped) ───────────────────────────────
router.get("/tag-taxonomy", requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  try {
    const groups = await db
      .select()
      .from(tagSynonymsTable)
      .where(eq(tagSynonymsTable.tenantId, tenantId))
      .orderBy(tagSynonymsTable.canonicalName);
    res.json(groups);
  } catch (err) {
    console.error("[tag-taxonomy GET]", err);
    res.status(500).json({ error: "Etiket grupları yüklenemedi" });
  }
});

// ─── GET tag usage counts (tenant-scoped interactions) ────────────────────────
router.get("/tag-taxonomy/tag-counts", requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  try {
    const rows = await db.execute(sql`
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT unnest(tags) AS tag
        FROM interaction_records
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
          AND tenant_id = ${tenantId}::uuid
      ) AS t
      GROUP BY tag
      ORDER BY cnt DESC
    `);
    res.json(rows.rows ?? rows);
  } catch (err) {
    console.error("[tag-taxonomy tag-counts]", err);
    res.status(500).json({ error: "Etiket sayıları yüklenemedi" });
  }
});

// ─── POST ai-suggest: AI groups existing tags into synonym clusters ────────────
// requireManager: AI suggestion is a privileged write-path operation
router.post("/tag-taxonomy/ai-suggest", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  try {
    // Use raw SQL unnest to get unique tags for this tenant
    const tagRows = await db.execute(sql`
      SELECT tag
      FROM (
        SELECT unnest(tags) AS tag
        FROM interaction_records
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
          AND tenant_id = ${tenantId}::uuid
      ) AS t
      GROUP BY tag
    `);
    const rawTagRows: any[] = (tagRows as any).rows ?? (Array.isArray(tagRows) ? tagRows : []);
    const allTags: string[] = rawTagRows.map((r: any) => r.tag).filter(Boolean);

    if (allTags.length < 2) {
      return res.json({ groups: [] });
    }

    // Exclude tags already grouped (tenant-scoped)
    const existingGroups = await db
      .select()
      .from(tagSynonymsTable)
      .where(eq(tagSynonymsTable.tenantId, tenantId));
    const alreadyGrouped = new Set(existingGroups.flatMap(g => [g.canonicalName, ...g.synonyms]));
    const ungroupedTags = allTags.filter(t => !alreadyGrouped.has(t));

    if (ungroupedTags.length < 2) {
      return res.json({ groups: [] });
    }

    const prompt = `Aşağıdaki etiket listesini incele ve semantik olarak aynı veya çok benzer anlamı olan etiketleri grupla.
Örnek: "ticket", "ticket çözümü", "ticket yönetimi" → bunlar "Destek Talebi" ana başlığı altında birleştirilebilir.

ETİKETLER:
${ungroupedTags.join(", ")}

Grupları JSON formatında döndür:
{
  "groups": [
    {
      "canonicalName": "<kısa, net, Türkçe ana etiket adı>",
      "synonyms": ["<bu grupla ilgili etiket1>", "<etiket2>", ...]
    }
  ]
}

Kurallar:
- Sadece birden fazla etiketi olan grupları dahil et (tek kalan etiketleri atla)
- canonicalName kısa ve açıklayıcı olmalı (en fazla 3 kelime)
- Emin olmadığın etiketleri ayrı gruba koyma, sadece açıkça benzer olanları grupla`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 8192 },
    });

    const raw = response.text?.trim() ?? "{}";
    let parsed: { groups?: Array<{ canonicalName: string; synonyms: string[] }> } = { groups: [] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        const stripped = raw.replace(/```(?:json)?/gi, "").trim();
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { groups: [] };
      }
    }

    res.json({ groups: parsed.groups ?? [] });
  } catch (err) {
    console.error("[tag-taxonomy ai-suggest]", err);
    res.status(500).json({ error: "AI önerisi alınamadı" });
  }
});

// ─── POST normalize-all: re-tag all interactions using synonym dictionary ──────
// Processes in batches of 500 to avoid memory exhaustion on large tenants.
const NORMALIZE_BATCH = 500;

router.post("/tag-taxonomy/normalize-all", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  try {
    const synonymMap = await buildSynonymMap(tenantId);
    if (synonymMap.size === 0) return res.json({ updated: 0 });

    let totalUpdated = 0;
    let lastId = 0; // keyset cursor — stable across updates
    const allChangedTags = new Set<string>();

    // Process in batches (keyset pagination via id > lastId ORDER BY id)
    // to avoid offset instability when rows are modified between pages.
    while (true) {
      const batch = await db
        .select({ id: interactionRecordsTable.id, tags: interactionRecordsTable.tags })
        .from(interactionRecordsTable)
        .where(
          and(
            eq(interactionRecordsTable.tenantId, tenantId),
            sql`tags IS NOT NULL AND array_length(tags, 1) > 0`,
            sql`${interactionRecordsTable.id} > ${lastId}`,
          ),
        )
        .orderBy(interactionRecordsTable.id)
        .limit(NORMALIZE_BATCH);

      if (batch.length === 0) break;

      const updates: Array<{ id: number; tags: string[] }> = [];
      for (const interaction of batch) {
        if (!interaction.tags?.length) continue;
        const normalizedTags = normalizeTags(interaction.tags, synonymMap);
        const origSorted = [...interaction.tags].sort().join(",");
        const normSorted = [...normalizedTags].sort().join(",");
        if (origSorted !== normSorted) {
          updates.push({ id: interaction.id, tags: normalizedTags });
          normalizedTags.forEach(t => allChangedTags.add(t));
        }
      }

      if (updates.length > 0) {
        await db.transaction(async (tx) => {
          for (const u of updates) {
            await tx
              .update(interactionRecordsTable)
              .set({ tags: u.tags })
              .where(eq(interactionRecordsTable.id, u.id));
          }
        });
        totalUpdated += updates.length;
      }

      lastId = batch[batch.length - 1].id;
      if (batch.length < NORMALIZE_BATCH) break;
    }

    // Refresh segment customer counts for all affected tags
    if (allChangedTags.size > 0) {
      refreshSegmentsForTags([...allChangedTags]).catch((e) =>
        console.error("[tag-taxonomy normalize-all] segment refresh error:", e),
      );
    }

    res.json({ updated: totalUpdated });
  } catch (err) {
    console.error("[tag-taxonomy normalize-all]", err);
    res.status(500).json({ error: "Normalize işlemi başarısız" });
  }
});

// ─── POST merge: merge synonym group B into canonical A ───────────────────────
router.post("/tag-taxonomy/merge", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  const { targetId, sourceId } = req.body as { targetId: number; sourceId: number };
  if (!targetId || !sourceId || targetId === sourceId) {
    return res.status(400).json({ error: "targetId ve sourceId farklı geçerli idler olmalı" });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(tagSynonymsTable)
        .where(and(eq(tagSynonymsTable.id, targetId), eq(tagSynonymsTable.tenantId, tenantId)));
      const [source] = await tx
        .select()
        .from(tagSynonymsTable)
        .where(and(eq(tagSynonymsTable.id, sourceId), eq(tagSynonymsTable.tenantId, tenantId)));
      if (!target || !source) throw Object.assign(new Error("Group not found"), { status: 404 });

      const mergedSynonyms = Array.from(
        new Set([...target.synonyms, source.canonicalName, ...source.synonyms])
      ).filter(s => s !== target.canonicalName);

      const [updated] = await tx
        .update(tagSynonymsTable)
        .set({ synonyms: mergedSynonyms, updatedAt: new Date() })
        .where(and(eq(tagSynonymsTable.id, targetId), eq(tagSynonymsTable.tenantId, tenantId)))
        .returning();

      await tx
        .delete(tagSynonymsTable)
        .where(and(eq(tagSynonymsTable.id, sourceId), eq(tagSynonymsTable.tenantId, tenantId)));
      return updated;
    });

    res.json(result);
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ error: "Grup bulunamadı" });
    console.error("[tag-taxonomy merge]", err);
    res.status(500).json({ error: "Birleştirme işlemi başarısız" });
  }
});

// ─── POST create a new synonym group (tenant-stamped) ─────────────────────────
router.post("/tag-taxonomy", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  const { canonicalName, synonyms = [] } = req.body as { canonicalName: string; synonyms?: string[] };
  if (!canonicalName?.trim()) {
    return res.status(400).json({ error: "canonicalName gereklidir" });
  }
  try {
    const [created] = await db
      .insert(tagSynonymsTable)
      .values({ canonicalName: canonicalName.trim(), synonyms, tenantId })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Bu canonical name zaten mevcut" });
    }
    console.error("[tag-taxonomy POST]", err);
    res.status(500).json({ error: "Grup oluşturulamadı" });
  }
});

// ─── PUT update synonym group (tenant-scoped) ─────────────────────────────────
router.put("/tag-taxonomy/:id", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  const id = Number(req.params.id);
  const { canonicalName, synonyms } = req.body as { canonicalName?: string; synonyms?: string[] };
  if (!id) return res.status(400).json({ error: "Geçersiz id" });

  const updates: Partial<{ canonicalName: string; synonyms: string[]; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (canonicalName !== undefined) updates.canonicalName = canonicalName.trim();
  if (synonyms !== undefined) updates.synonyms = synonyms;

  try {
    const [updated] = await db
      .update(tagSynonymsTable)
      .set(updates)
      .where(and(eq(tagSynonymsTable.id, id), eq(tagSynonymsTable.tenantId, tenantId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Bulunamadı" });
    res.json(updated);
  } catch (err) {
    console.error("[tag-taxonomy PUT]", err);
    res.status(500).json({ error: "Güncelleme başarısız" });
  }
});

// ─── DELETE synonym group (tenant-scoped) ─────────────────────────────────────
router.delete("/tag-taxonomy/:id", requireManager, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Aktif tenant seçili değil" });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  try {
    const [deleted] = await db
      .delete(tagSynonymsTable)
      .where(and(eq(tagSynonymsTable.id, id), eq(tagSynonymsTable.tenantId, tenantId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Bulunamadı" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[tag-taxonomy DELETE]", err);
    res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

export default router;
