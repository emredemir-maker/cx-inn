/**
 * CX Analysis Service
 *
 * Single source of truth for all Gemini-powered CX analysis logic.
 * Consolidates three previously diverging implementations:
 *   - lib/analyze.ts           (had synonym normalization + learning, no segment refresh)
 *   - routes/cx_analyses.ts (single handler — missing synonym normalization)
 *   - routes/cx_analyses.ts (bulk loop  — missing synonym normalization)
 *
 * This service is the canonical implementation and uses ALL features:
 *   PII stripping, synonym normalization, learning corrections,
 *   robust JSON parsing, and segment refresh.
 */

import { db } from "@workspace/db";
import {
  cxAnalysesTable,
  interactionRecordsTable,
  customersTable,
  tagSynonymsTable,
} from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { getLearningCorrections, markLearningUsed } from "../lib/accuracy";
import { refreshSegmentsForTags } from "./segment.service";
import { writeAuditLog } from "../lib/audit";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildSynonymMap(): Promise<Map<string, string>> {
  const groups = await db.select().from(tagSynonymsTable);
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const syn of group.synonyms) {
      map.set(syn.toLowerCase(), group.canonicalName);
    }
  }
  return map;
}

function normalizeTags(tags: string[], synonymMap: Map<string, string>): string[] {
  return Array.from(new Set(tags.map((t) => synonymMap.get(t.toLowerCase()) ?? t)));
}

function stripPii(text: string): string {
  if (!text) return text;
  return text
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[E-POSTA]")
    .replace(/(\+?[\d][\d\s\-()]{7,}[\d])/g, "[TELEFON]");
}

/**
 * Parse a raw Gemini response string into a structured analysis object.
 * Uses two fallback strategies for robustness:
 *   1. Direct JSON extraction from the largest {...} block
 *   2. Strip markdown fences then retry
 */
function parseGeminiResponse(raw: string): Record<string, any> {
  let parsed: Record<string, any> = {};
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    try {
      const stripped = raw.replace(/```(?:json)?/gi, "").trim();
      const match2 = stripped.match(/\{[\s\S]*\}/);
      if (match2) parsed = JSON.parse(match2[0]);
    } catch {
      parsed = {};
    }
  }

  // Coerce string numbers that Gemini sometimes returns
  if (typeof parsed.predictedNps === "string") parsed.predictedNps = parseFloat(parsed.predictedNps);
  if (typeof parsed.predictedCsat === "string") parsed.predictedCsat = parseFloat(parsed.predictedCsat);
  if (isNaN(parsed.predictedNps)) parsed.predictedNps = null;
  if (isNaN(parsed.predictedCsat)) parsed.predictedCsat = null;

  return parsed;
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPrompt(
  customer: { name: string; company?: string | null; segment?: string | null; npsScore?: number | null },
  interactions: Array<{ id: number; type: string; subject?: string | null; status: string; channel: string; content?: string | null; resolution?: string | null }>,
  opts: { learningBlock?: string; canonicalVocabBlock?: string; compact?: boolean } = {},
): string {
  const { learningBlock = "", canonicalVocabBlock = "", compact = false } = opts;

  const interactionText = interactions
    .map((i) =>
      compact
        ? `[ID:${i.id}] Tür: ${i.type} | Konu: ${i.subject} | Durum: ${i.status}\nİçerik: ${i.content}${i.resolution ? `\nÇözüm: ${i.resolution}` : ""}`
        : `[ID:${i.id}] Tür: ${i.type} | Konu: ${stripPii(i.subject ?? "")} | Durum: ${i.status} | Kanal: ${i.channel}\nİçerik: ${stripPii(i.content ?? "")}${i.resolution ? `\nÇözüm: ${stripPii(i.resolution)}` : ""}`,
    )
    .join("\n\n");

  const maxNps = compact ? 4 : 5;
  const maxTopics = compact ? 6 : 7;
  const summaryWords = compact ? "80-100" : "100-150";
  const recWords = compact ? "50-80" : "80-120";

  return `Sen bir müşteri deneyimi (CX) uzmanı yapay zekasısın. Aşağıdaki B2B müşteri etkileşim geçmişini analiz et ve JSON formatında sonuç döndür.

MÜŞTERİ BİLGİLERİ:
- Ad: ${customer.name}
- Firma: ${customer.company || customer.segment || "Bilinmiyor"}
- Mevcut NPS Skoru: ${customer.npsScore ?? "Bilinmiyor"}
${learningBlock}${canonicalVocabBlock}
ETKİLEŞİM GEÇMİŞİ (${interactions.length} kayıt, hariç tutulanlar dahil edilmedi):
${interactionText}

GÖREV: Bu etkileşimlere dayanarak aşağıdaki analizi JSON formatında döndür:
{
  "predictedNps": <0-10 arası tahmin edilen NPS skoru, ondalıklı>,
  "predictedCsat": <1-5 arası tahmin edilen CSAT skoru, ondalıklı>,
  "overallSentiment": <"positive" | "neutral" | "negative">,
  "churnRisk": <"low" | "medium" | "high">,
  "painPoints": [<en fazla ${maxNps} acı nokta, Türkçe kısa cümle>],
  "keyTopics": [<en fazla ${maxTopics} konu etiketi — kısa, tek veya iki kelimelik Türkçe etiketler${canonicalVocabBlock ? ", KANONİK SÖZLÜKTEN seç" : ""}>],
  "interactionTags": { "<interaction_id>": [<2-4 kısa Türkçe etiket${canonicalVocabBlock ? ", KANONİK SÖZLÜKTEN seç" : ""}>] },
  "summary": <${summaryWords} kelime Türkçe özet>,
  "recommendations": <${recWords} kelime Türkçe aksiyon önerileri>
}

interactionTags alanında her etkileşim ID'si için 2-4 kısa etiket döndür. ID'ler: ${interactions.map((i) => i.id).join(", ")}
Sadece JSON döndür, başka hiçbir şey yazma.`;
}

// ── Core analysis function ────────────────────────────────────────────────────

async function runAnalysis(
  customerId: number,
  interactions: Array<{ id: number; type: string; subject?: string | null; status: string; channel: string; content?: string | null; resolution?: string | null }>,
  compact = false,
): Promise<Record<string, any>> {
  const custRows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  if (!custRows.length) throw new Error(`Customer ${customerId} not found`);
  const customer = custRows[0];

  const learningBlock = await getLearningCorrections(customerId);
  const synonymMap = await buildSynonymMap();
  const canonicalTags = await db
    .select({ canonicalName: tagSynonymsTable.canonicalName, synonyms: tagSynonymsTable.synonyms })
    .from(tagSynonymsTable);
  const canonicalVocabBlock =
    canonicalTags.length > 0
      ? `\nKANONİK ETİKET SÖZLÜĞÜ (bu etiketleri tercih et, yeni etiket oluşturmaktan kaçın):\n${canonicalTags.map((g) => `- ${g.canonicalName}${g.synonyms.length ? ` (ayrıca: ${g.synonyms.join(", ")})` : ""}`).join("\n")}\n`
      : "";

  const prompt = buildPrompt(customer, interactions, { learningBlock, canonicalVocabBlock, compact });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: compact ? 2048 : 4096 },
  });

  const raw = response.text?.trim() ?? "{}";
  const parsed = parseGeminiResponse(raw);

  // Normalize key topics using synonym map
  if (Array.isArray(parsed.keyTopics)) {
    parsed.keyTopics = normalizeTags(parsed.keyTopics, synonymMap);
  }

  // Update interaction tags (normalized)
  if (parsed.interactionTags && typeof parsed.interactionTags === "object") {
    for (const [idStr, tags] of Object.entries(parsed.interactionTags)) {
      const id = Number(idStr);
      if (id && Array.isArray(tags)) {
        const normalizedTags = normalizeTags(tags as string[], synonymMap);
        await db
          .update(interactionRecordsTable)
          .set({ tags: normalizedTags })
          .where(eq(interactionRecordsTable.id, id));
      }
    }
    // Async segment refresh — does not block the response
    const allNewTags = Object.values(parsed.interactionTags as Record<string, string[]>).flat();
    refreshSegmentsForTags(allNewTags).catch((e) =>
      console.error("[cx-analysis.service] segment refresh error:", e),
    );
  }

  return { parsed, customer };
}

async function persistAnalysis(
  customerId: number,
  customer: { npsScore?: number | null; sentiment?: string | null; churnRisk?: string | null },
  parsed: Record<string, any>,
  interactionIds: number[],
) {
  const [analysis] = await db
    .insert(cxAnalysesTable)
    .values({
      customerId,
      predictedNps: parsed.predictedNps ?? null,
      predictedCsat: parsed.predictedCsat ?? null,
      overallSentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment)
        ? parsed.overallSentiment
        : "neutral",
      churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk) ? parsed.churnRisk : "low",
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      summary: parsed.summary ?? null,
      recommendations: parsed.recommendations ?? null,
      interactionIds,
      model: "gemini-2.5-flash",
    })
    .returning();

  await db
    .update(customersTable)
    .set({
      npsScore: parsed.predictedNps ?? customer.npsScore,
      sentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment)
        ? parsed.overallSentiment
        : customer.sentiment,
      churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk)
        ? parsed.churnRisk
        : customer.churnRisk,
      lastInteraction: new Date(),
    })
    .where(eq(customersTable.id, customerId));

  return analysis;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze a single customer. Returns the inserted CxAnalysis row.
 * `interactionIds` is optional — if omitted, the 20 most recent non-excluded
 * interactions are used automatically.
 */
export async function analyzeCustomerById(
  customerId: number,
  opts: { interactionIds?: number[]; userId?: string } = {},
) {
  let interactions;
  if (opts.interactionIds && opts.interactionIds.length > 0) {
    interactions = await db
      .select()
      .from(interactionRecordsTable)
      .where(
        and(
          inArray(interactionRecordsTable.id, opts.interactionIds.map(Number)),
          eq(interactionRecordsTable.excludedFromAnalysis, false),
        ),
      );
  } else {
    interactions = await db
      .select()
      .from(interactionRecordsTable)
      .where(
        and(
          eq(interactionRecordsTable.customerId, customerId),
          eq(interactionRecordsTable.excludedFromAnalysis, false),
        ),
      )
      .orderBy(desc(interactionRecordsTable.interactedAt))
      .limit(20);
  }

  if (!interactions.length) {
    throw new Error("Bu müşteri için hariç tutulmayan etkileşim kaydı bulunamadı.");
  }

  const { parsed, customer } = await runAnalysis(customerId, interactions, false);
  const analysis = await persistAnalysis(customerId, customer, parsed, interactions.map((i) => i.id));

  await markLearningUsed(customerId);

  await writeAuditLog(
    "CX_ANALYSIS",
    "cx_analyses",
    analysis.id,
    opts.userId ?? "system",
    `Gemini CX analizi: ${customer.name} (${customer.company || customer.segment}), NPS: ${parsed.predictedNps}, CSAT: ${parsed.predictedCsat}, Churn: ${parsed.churnRisk}`,
  );

  return analysis;
}

/**
 * Analyze multiple customers sequentially in the background.
 * Returns immediately — the caller should already have sent the HTTP response.
 */
export async function bulkAnalyzeCustomers(
  customerIds: number[],
  userId = "system",
): Promise<void> {
  for (const customerId of customerIds) {
    try {
      const interactions = await db
        .select()
        .from(interactionRecordsTable)
        .where(
          and(
            eq(interactionRecordsTable.customerId, customerId),
            eq(interactionRecordsTable.excludedFromAnalysis, false),
          ),
        )
        .orderBy(desc(interactionRecordsTable.interactedAt))
        .limit(20);

      if (!interactions.length) continue;

      const { parsed, customer } = await runAnalysis(customerId, interactions, true /* compact */);
      await persistAnalysis(customerId, customer, parsed, interactions.map((i) => i.id));
      await markLearningUsed(customerId);

      // Small delay to avoid Gemini rate limiting
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[cx-analysis.service] bulk analyze error for customer ${customerId}:`, err);
    }
  }
  console.log(`[cx-analysis.service] Bulk analysis completed for ${customerIds.length} customers.`);
}
