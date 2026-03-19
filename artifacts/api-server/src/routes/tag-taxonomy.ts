import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tagSynonymsTable, interactionRecordsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth, requireRole } from "../middleware/requireRole";

const router: IRouter = Router();

// ─── Auth: all routes require a logged-in user; write routes require manager+ ─
//     GET endpoints: requireAuth
//     mutating endpoints (POST/PUT/DELETE): requireRole("superadmin","cx_manager")
const requireManager = requireRole("superadmin", "cx_manager");

// ─── GET all tag synonym groups ───────────────────────────────────────────────
router.get("/tag-taxonomy", requireAuth, async (_req, res) => {
  try {
    const groups = await db.select().from(tagSynonymsTable).orderBy(tagSynonymsTable.canonicalName);
    res.json(groups);
  } catch (err) {
    console.error("[tag-taxonomy GET]", err);
    res.status(500).json({ error: "Etiket grupları yüklenemedi" });
  }
});

// ─── GET tag usage counts (all unique tags in interactions) ───────────────────
router.get("/tag-taxonomy/tag-counts", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT unnest(tags) AS tag
        FROM interaction_records
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
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
// (static routes BEFORE :id param routes to avoid shadowing)
router.post("/tag-taxonomy/ai-suggest", requireAuth, async (_req, res) => {
  try {
    // Use raw SQL unnest to get unique tags efficiently (avoids loading all rows)
    const tagRows = await db.execute(sql`
      SELECT tag
      FROM (
        SELECT unnest(tags) AS tag
        FROM interaction_records
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
      ) AS t
      GROUP BY tag
    `);
    const rawTagRows: any[] = (tagRows as any).rows ?? (Array.isArray(tagRows) ? tagRows : []);
    const allTags: string[] = rawTagRows.map((r: any) => r.tag).filter(Boolean);

    if (allTags.length < 2) {
      return res.json({ groups: [] });
    }

    // Exclude tags already grouped
    const existingGroups = await db.select().from(tagSynonymsTable);
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
router.post("/tag-taxonomy/normalize-all", requireManager, async (_req, res) => {
  try {
    const groups = await db.select().from(tagSynonymsTable);
    if (groups.length === 0) return res.json({ updated: 0 });

    // Build synonym → canonical map
    const synonymMap = new Map<string, string>();
    for (const group of groups) {
      for (const syn of group.synonyms) {
        synonymMap.set(syn.toLowerCase(), group.canonicalName);
      }
    }

    // Fetch all interactions with tags
    const interactions = await db
      .select({ id: interactionRecordsTable.id, tags: interactionRecordsTable.tags })
      .from(interactionRecordsTable)
      .where(sql`tags IS NOT NULL AND array_length(tags, 1) > 0`);

    // Build list of updates to perform
    const updates: Array<{ id: number; tags: string[] }> = [];
    for (const interaction of interactions) {
      if (!interaction.tags?.length) continue;

      const normalizedTags = Array.from(
        new Set(
          interaction.tags.map(tag => synonymMap.get(tag.toLowerCase()) ?? tag)
        )
      );

      // Content-based change detection: sort both arrays before comparing
      const origSorted = [...interaction.tags].sort().join(",");
      const normSorted = [...normalizedTags].sort().join(",");
      if (origSorted !== normSorted) {
        updates.push({ id: interaction.id, tags: normalizedTags });
      }
    }

    // Apply all updates inside a single transaction
    if (updates.length > 0) {
      await db.transaction(async (tx) => {
        for (const u of updates) {
          await tx
            .update(interactionRecordsTable)
            .set({ tags: u.tags })
            .where(eq(interactionRecordsTable.id, u.id));
        }
      });
    }

    res.json({ updated: updates.length });
  } catch (err) {
    console.error("[tag-taxonomy normalize-all]", err);
    res.status(500).json({ error: "Normalize işlemi başarısız" });
  }
});

// ─── POST merge: merge synonym group B into canonical A ───────────────────────
router.post("/tag-taxonomy/merge", requireManager, async (req, res) => {
  const { targetId, sourceId } = req.body as { targetId: number; sourceId: number };
  if (!targetId || !sourceId || targetId === sourceId) {
    return res.status(400).json({ error: "targetId ve sourceId farklı geçerli idler olmalı" });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx.select().from(tagSynonymsTable).where(eq(tagSynonymsTable.id, targetId));
      const [source] = await tx.select().from(tagSynonymsTable).where(eq(tagSynonymsTable.id, sourceId));
      if (!target || !source) throw Object.assign(new Error("Group not found"), { status: 404 });

      const mergedSynonyms = Array.from(
        new Set([...target.synonyms, source.canonicalName, ...source.synonyms])
      ).filter(s => s !== target.canonicalName);

      const [updated] = await tx
        .update(tagSynonymsTable)
        .set({ synonyms: mergedSynonyms, updatedAt: new Date() })
        .where(eq(tagSynonymsTable.id, targetId))
        .returning();

      await tx.delete(tagSynonymsTable).where(eq(tagSynonymsTable.id, sourceId));
      return updated;
    });

    res.json(result);
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ error: "Grup bulunamadı" });
    console.error("[tag-taxonomy merge]", err);
    res.status(500).json({ error: "Birleştirme işlemi başarısız" });
  }
});

// ─── POST create a new synonym group ─────────────────────────────────────────
router.post("/tag-taxonomy", requireManager, async (req, res) => {
  const { canonicalName, synonyms = [] } = req.body as { canonicalName: string; synonyms?: string[] };
  if (!canonicalName?.trim()) {
    return res.status(400).json({ error: "canonicalName gereklidir" });
  }
  try {
    const [created] = await db
      .insert(tagSynonymsTable)
      .values({ canonicalName: canonicalName.trim(), synonyms })
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

// ─── PUT update synonym group ─────────────────────────────────────────────────
router.put("/tag-taxonomy/:id", requireManager, async (req, res) => {
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
      .where(eq(tagSynonymsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Bulunamadı" });
    res.json(updated);
  } catch (err) {
    console.error("[tag-taxonomy PUT]", err);
    res.status(500).json({ error: "Güncelleme başarısız" });
  }
});

// ─── DELETE synonym group ─────────────────────────────────────────────────────
router.delete("/tag-taxonomy/:id", requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  try {
    const [deleted] = await db
      .delete(tagSynonymsTable)
      .where(eq(tagSynonymsTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Bulunamadı" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[tag-taxonomy DELETE]", err);
    res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

export default router;
