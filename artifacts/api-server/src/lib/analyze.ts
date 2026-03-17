import { db } from "@workspace/db";
import { cxAnalysesTable, interactionRecordsTable, customersTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { getLearningCorrections, markLearningUsed } from "./accuracy";

export async function analyzeCustomer(customerId: number): Promise<void> {
  const cust = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!cust.length) return;
  const customer = cust[0];

  // Fetch ONLY non-excluded interactions
  const interactions = await db.select().from(interactionRecordsTable)
    .where(
      and(
        eq(interactionRecordsTable.customerId, customerId),
        eq(interactionRecordsTable.excludedFromAnalysis, false)
      )
    )
    .orderBy(desc(interactionRecordsTable.interactedAt))
    .limit(20);

  if (!interactions.length) {
    console.log(`analyzeCustomer: no non-excluded interactions for customer ${customerId}, skipping.`);
    return;
  }

  const interactionText = interactions.map((i) =>
    `[ID:${i.id}] Tür: ${i.type} | Konu: ${i.subject} | Durum: ${i.status} | Kanal: ${i.channel}\nİçerik: ${i.content}${i.resolution ? `\nÇözüm: ${i.resolution}` : ""}`
  ).join("\n\n");

  // Fetch past prediction corrections for this customer (learning data)
  const learningBlock = await getLearningCorrections(customerId);

  const prompt = `Sen bir müşteri deneyimi (CX) uzmanı yapay zekasısın. Aşağıdaki B2B müşteri etkileşim geçmişini analiz et ve JSON formatında sonuç döndür.

MÜŞTERİ BİLGİLERİ:
- Ad: ${customer.name}
- Firma: ${customer.company || customer.segment || "Bilinmiyor"}
- Mevcut NPS Skoru: ${customer.npsScore ?? "Bilinmiyor"}
${learningBlock}
ETKİLEŞİM GEÇMİŞİ (${interactions.length} kayıt, hariç tutulanlar dahil edilmedi):
${interactionText}

GÖREV: Bu etkileşimlere dayanarak aşağıdaki analizi JSON formatında döndür:
{
  "predictedNps": <0-10 arası tahmin edilen NPS skoru, ondalıklı>,
  "predictedCsat": <1-5 arası tahmin edilen CSAT skoru, ondalıklı>,
  "overallSentiment": <"positive" | "neutral" | "negative">,
  "churnRisk": <"low" | "medium" | "high">,
  "painPoints": [<en fazla 5 acı nokta, Türkçe kısa cümle>],
  "keyTopics": [<en fazla 7 konu etiketi — kısa, tek veya iki kelimelik Türkçe etiketler>],
  "interactionTags": { "<interaction_id>": [<2-4 kısa Türkçe etiket>] },
  "summary": <100-150 kelime Türkçe özet>,
  "recommendations": <80-120 kelime Türkçe aksiyon önerileri>
}

interactionTags alanında her etkileşim ID'si için 2-4 kısa etiket döndür. ID'ler: ${interactions.map(i => i.id).join(", ")}
Sadece JSON döndür, başka hiçbir şey yazma.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  });

  const raw = response.text?.trim() ?? "{}";
  let parsed: any = {};
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    try {
      const stripped = raw.replace(/```(?:json)?/gi, "").trim();
      const jsonMatch2 = stripped.match(/\{[\s\S]*\}/);
      if (jsonMatch2) parsed = JSON.parse(jsonMatch2[0]);
    } catch { parsed = {}; }
  }

  if (typeof parsed.predictedNps === "string") parsed.predictedNps = parseFloat(parsed.predictedNps);
  if (typeof parsed.predictedCsat === "string") parsed.predictedCsat = parseFloat(parsed.predictedCsat);
  if (isNaN(parsed.predictedNps)) parsed.predictedNps = null;
  if (isNaN(parsed.predictedCsat)) parsed.predictedCsat = null;

  if (parsed.interactionTags && typeof parsed.interactionTags === "object") {
    for (const [idStr, tags] of Object.entries(parsed.interactionTags)) {
      const id = Number(idStr);
      if (id && Array.isArray(tags)) {
        await db.update(interactionRecordsTable).set({ tags: tags as string[] })
          .where(eq(interactionRecordsTable.id, id));
      }
    }
  }

  await db.insert(cxAnalysesTable).values({
    customerId,
    predictedNps: parsed.predictedNps ?? null,
    predictedCsat: parsed.predictedCsat ?? null,
    overallSentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment) ? parsed.overallSentiment : "neutral",
    churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk) ? parsed.churnRisk : "low",
    painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
    keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
    summary: parsed.summary ?? null,
    recommendations: parsed.recommendations ?? null,
    interactionIds: interactions.map(i => i.id),
    model: "gemini-2.5-flash",
  });

  await db.update(customersTable).set({
    npsScore: parsed.predictedNps ?? customer.npsScore,
    sentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment) ? parsed.overallSentiment : customer.sentiment,
    churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk) ? parsed.churnRisk : customer.churnRisk,
    lastInteraction: new Date(),
  }).where(eq(customersTable.id, customerId));

  // Mark past corrections as used in learning (avoid re-using same examples)
  await markLearningUsed(customerId);

  console.log(`analyzeCustomer: re-analysis complete for customer ${customerId} (${interactions.length} non-excluded interactions${learningBlock ? ", with learning corrections" : ""})`);
}
