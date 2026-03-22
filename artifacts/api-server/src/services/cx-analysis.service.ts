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
import { buildSynonymMap, normalizeTags } from "../lib/tag-helpers";

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
  const synonymMap = await buildSynonymMap(customer.tenantId ?? null);
  const canonicalTagsBase = db
    .select({ canonicalName: tagSynonymsTable.canonicalName, synonyms: tagSynonymsTable.synonyms })
    .from(tagSynonymsTable);
  const canonicalTags = customer.tenantId
    ? await canonicalTagsBase.where(eq(tagSynonymsTable.tenantId, customer.tenantId))
    : await canonicalTagsBase;
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
  // Guard: always scope UPDATE to tenant to prevent AI-hallucinated IDs writing to other tenants
  if (parsed.interactionTags && typeof parsed.interactionTags === "object") {
    for (const [idStr, tags] of Object.entries(parsed.interactionTags)) {
      const id = Number(idStr);
      if (id && Array.isArray(tags) && customer.tenantId) {
        const normalizedTags = normalizeTags(tags as string[], synonymMap);
        await db
          .update(interactionRecordsTable)
          .set({ tags: normalizedTags })
          .where(
            and(
              eq(interactionRecordsTable.id, id),
              eq(interactionRecordsTable.tenantId, customer.tenantId),
            ),
          );
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

// ── Batch analysis helpers ────────────────────────────────────────────────────

const BATCH_SIZE = 5;        // customers per Gemini call
const BATCH_CONCURRENCY = 3; // parallel Gemini calls at a time

type CustomerRow = Awaited<ReturnType<typeof db.select>>[number] & {
  id: number; name: string; company?: string | null;
  segment?: string | null; npsScore?: number | null;
  sentiment?: string | null; churnRisk?: string | null;
};

type InteractionRow = {
  id: number; customerId: number; type: string;
  subject?: string | null; status: string; channel: string;
  content?: string | null; resolution?: string | null;
};

/** Build a single prompt that asks Gemini to analyse N customers at once. */
function buildBatchPrompt(
  customers: CustomerRow[],
  interactionsByCustomer: Map<number, InteractionRow[]>,
  canonicalVocabBlock: string,
): string {
  const customersBlock = customers
    .map((c, idx) => {
      const ixs = interactionsByCustomer.get(c.id) ?? [];
      const ixText = ixs
        .map(
          (i) =>
            `  [ID:${i.id}] Tür: ${i.type} | Konu: ${stripPii(i.subject ?? "")} | Durum: ${i.status}\n` +
            `  İçerik: ${stripPii(i.content ?? "")}` +
            (i.resolution ? `\n  Çözüm: ${stripPii(i.resolution)}` : ""),
        )
        .join("\n\n");
      return (
        `--- MÜŞTERİ ${idx + 1} (customerId: ${c.id}) ---\n` +
        `Ad: ${c.name} | Firma: ${c.company || c.segment || "Bilinmiyor"} | Mevcut NPS: ${c.npsScore ?? "Bilinmiyor"}\n` +
        `Etkileşimler (${ixs.length} kayıt):\n${ixText}`
      );
    })
    .join("\n\n");

  const idList = customers.map((c) => c.id).join(", ");

  return (
    `Sen bir müşteri deneyimi (CX) uzmanı yapay zekasısın. ` +
    `Aşağıda ${customers.length} farklı müşterinin etkileşim verisi var. Her biri için CX analizi yap.\n` +
    `${canonicalVocabBlock}\n` +
    `${customersBlock}\n\n` +
    `GÖREV: Yukarıdaki her müşteri için JSON DİZİSİ döndür (customerId listesi: ${idList}):\n` +
    `[\n` +
    `  {\n` +
    `    "customerId": <müşteri ID>,\n` +
    `    "predictedNps": <0-10 ondalıklı>,\n` +
    `    "predictedCsat": <1-5 ondalıklı>,\n` +
    `    "overallSentiment": <"positive"|"neutral"|"negative">,\n` +
    `    "churnRisk": <"low"|"medium"|"high">,\n` +
    `    "painPoints": [<en fazla 4 Türkçe acı nokta>],\n` +
    `    "keyTopics": [<en fazla 5 Türkçe konu etiketi>],\n` +
    `    "interactionTags": { "<interaction_id>": [<2-3 Türkçe etiket>] },\n` +
    `    "summary": <80-100 kelime Türkçe özet>,\n` +
    `    "recommendations": <50-80 kelime Türkçe aksiyon önerileri>\n` +
    `  },\n` +
    `  ...\n` +
    `]\n` +
    `Sadece JSON dizisi döndür, başka hiçbir şey yazma.`
  );
}

/** Extract JSON array from Gemini batch response. */
function parseBatchResponse(raw: string): Record<string, any>[] {
  const tryParse = (s: string): Record<string, any>[] | null => {
    const match = s.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };
  return (
    tryParse(raw) ??
    tryParse(raw.replace(/```(?:json)?/gi, "").trim()) ??
    []
  );
}

/**
 * Send one Gemini request for a batch of customers, then persist all results.
 * Falls back to individual sequential analysis if the batch call fails.
 */
async function runAndPersistBatch(
  batchCustomerIds: number[],
  synonymMap: Map<string, string>,
  canonicalVocabBlock: string,
): Promise<void> {
  // ── Fetch customers & interactions in 2 parallel DB queries ─────────────
  const [customers, allInteractions] = await Promise.all([
    db
      .select()
      .from(customersTable)
      .where(inArray(customersTable.id, batchCustomerIds)) as Promise<CustomerRow[]>,
    db
      .select()
      .from(interactionRecordsTable)
      .where(
        and(
          inArray(interactionRecordsTable.customerId, batchCustomerIds),
          eq(interactionRecordsTable.excludedFromAnalysis, false),
        ),
      )
      .orderBy(desc(interactionRecordsTable.interactedAt)) as Promise<InteractionRow[]>,
  ]);

  // Group interactions by customer (cap at 15 to control prompt size)
  const interactionsByCustomer = new Map<number, InteractionRow[]>();
  for (const ix of allInteractions) {
    const list = interactionsByCustomer.get(ix.customerId) ?? [];
    if (list.length < 15) { list.push(ix); interactionsByCustomer.set(ix.customerId, list); }
  }

  const validCustomers = customers.filter(
    (c) => (interactionsByCustomer.get(c.id) ?? []).length > 0,
  );
  if (!validCustomers.length) return;

  // ── Single Gemini call for the whole batch ───────────────────────────────
  const prompt = buildBatchPrompt(validCustomers, interactionsByCustomer, canonicalVocabBlock);

  let results: Record<string, any>[];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: validCustomers.length * 1200 },
    });
    results = parseBatchResponse(response.text?.trim() ?? "[]");
  } catch (err) {
    console.error("[cx-analysis.service] batch Gemini call failed, falling back to sequential:", err);
    results = [];
  }

  // ── Persist each result that was returned ────────────────────────────────
  const handledIds = new Set<number>();

  for (const result of results) {
    const customerId = Number(result.customerId);
    if (!customerId) continue;

    const customer = validCustomers.find((c) => c.id === customerId);
    if (!customer) continue;

    if (typeof result.predictedNps === "string") result.predictedNps = parseFloat(result.predictedNps);
    if (typeof result.predictedCsat === "string") result.predictedCsat = parseFloat(result.predictedCsat);
    if (isNaN(result.predictedNps)) result.predictedNps = null;
    if (isNaN(result.predictedCsat)) result.predictedCsat = null;

    if (Array.isArray(result.keyTopics)) result.keyTopics = normalizeTags(result.keyTopics, synonymMap);

    if (result.interactionTags && typeof result.interactionTags === "object") {
      const allNewTags: string[] = [];
      for (const [idStr, tags] of Object.entries(result.interactionTags)) {
        const id = Number(idStr);
        // Guard: scope UPDATE to customer's tenant to prevent AI-hallucinated IDs writing elsewhere
        if (id && Array.isArray(tags) && customer.tenantId) {
          const normalizedTags = normalizeTags(tags as string[], synonymMap);
          await db
            .update(interactionRecordsTable)
            .set({ tags: normalizedTags })
            .where(
              and(
                eq(interactionRecordsTable.id, id),
                eq(interactionRecordsTable.tenantId, customer.tenantId),
              ),
            );
          allNewTags.push(...normalizedTags);
        }
      }
      refreshSegmentsForTags(allNewTags).catch((e) =>
        console.error("[cx-analysis.service] segment refresh error:", e),
      );
    }

    const ixIds = (interactionsByCustomer.get(customerId) ?? []).map((i) => i.id);
    await persistAnalysis(customerId, customer, result, ixIds);
    await markLearningUsed(customerId);
    handledIds.add(customerId);
  }

  // ── Fall back individually for any customer Gemini skipped ───────────────
  for (const customer of validCustomers) {
    if (handledIds.has(customer.id)) continue;
    console.warn(`[cx-analysis.service] batch missed customerId ${customer.id}, running individually`);
    try {
      const ixs = interactionsByCustomer.get(customer.id) ?? [];
      const { parsed } = await runAnalysis(customer.id, ixs, true);
      await persistAnalysis(customer.id, customer, parsed, ixs.map((i) => i.id));
      await markLearningUsed(customer.id);
    } catch (e) {
      console.error(`[cx-analysis.service] individual fallback failed for ${customer.id}:`, e);
    }
  }
}

/**
 * Analyze multiple customers using batched Gemini calls in parallel.
 * Groups customers into batches of BATCH_SIZE, then runs BATCH_CONCURRENCY
 * batches at a time — typically 4-6× faster than sequential single-customer calls.
 * Returns immediately — the caller should already have sent the HTTP response.
 */
export async function bulkAnalyzeCustomers(
  customerIds: number[],
  userId = "system",
  tenantId?: string | null,
): Promise<void> {
  // Shared resources fetched once for the entire run (scoped to tenant when available)
  const synonymMap = await buildSynonymMap(tenantId ?? null);
  const canonicalTagsBase = db
    .select({ canonicalName: tagSynonymsTable.canonicalName, synonyms: tagSynonymsTable.synonyms })
    .from(tagSynonymsTable);
  const canonicalTags = tenantId
    ? await canonicalTagsBase.where(eq(tagSynonymsTable.tenantId, tenantId))
    : await canonicalTagsBase;
  const canonicalVocabBlock =
    canonicalTags.length > 0
      ? `\nKANONİK ETİKET SÖZLÜĞÜ (bu etiketleri tercih et, yeni etiket oluşturmaktan kaçın):\n` +
        canonicalTags
          .map((g: { canonicalName: string; synonyms: string[] }) =>
            `- ${g.canonicalName}${g.synonyms.length ? ` (ayrıca: ${g.synonyms.join(", ")})` : ""}`,
          )
          .join("\n") +
        `\n`
      : "";

  // Chunk customer IDs into batches of BATCH_SIZE
  const batches: number[][] = [];
  for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
    batches.push(customerIds.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `[cx-analysis.service] Starting batch analysis: ${customerIds.length} customers → ` +
    `${batches.length} batches (size=${BATCH_SIZE}, concurrency=${BATCH_CONCURRENCY})`,
  );

  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const round = batches.slice(i, i + BATCH_CONCURRENCY);
    await Promise.allSettled(
      round.map((batch) =>
        runAndPersistBatch(batch, synonymMap, canonicalVocabBlock).catch((err) =>
          console.error(`[cx-analysis.service] batch error:`, err),
        ),
      ),
    );
    // Brief pause between concurrency rounds to respect rate limits
    if (i + BATCH_CONCURRENCY < batches.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log(`[cx-analysis.service] Batch analysis completed for ${customerIds.length} customers.`);
}
