import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cxAnalysesTable, interactionRecordsTable, customersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

// ─── LIST ────────────────────────────────────────────────────────────────────
router.get("/cx-analyses", async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const query = db
      .select({
        id: cxAnalysesTable.id,
        customerId: cxAnalysesTable.customerId,
        customerName: customersTable.name,
        predictedNps: cxAnalysesTable.predictedNps,
        predictedCsat: cxAnalysesTable.predictedCsat,
        overallSentiment: cxAnalysesTable.overallSentiment,
        churnRisk: cxAnalysesTable.churnRisk,
        painPoints: cxAnalysesTable.painPoints,
        keyTopics: cxAnalysesTable.keyTopics,
        summary: cxAnalysesTable.summary,
        recommendations: cxAnalysesTable.recommendations,
        interactionIds: cxAnalysesTable.interactionIds,
        model: cxAnalysesTable.model,
        createdAt: cxAnalysesTable.createdAt,
      })
      .from(cxAnalysesTable)
      .leftJoin(customersTable, eq(cxAnalysesTable.customerId, customersTable.id))
      .orderBy(desc(cxAnalysesTable.createdAt));

    const rows = customerId
      ? await query.where(and(eq(cxAnalysesTable.customerId, customerId), eq(customersTable.isExcluded, false)))
      : await query.where(eq(customersTable.isExcluded, false));

    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt?.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── SINGLE CUSTOMER ANALYZE ─────────────────────────────────────────────────
router.post("/cx-analyses/analyze", async (req, res) => {
  try {
    const { customerId, interactionIds } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId zorunludur." });

    const customer = await db.select().from(customersTable).where(eq(customersTable.id, Number(customerId))).limit(1);
    if (!customer.length) return res.status(404).json({ error: "Müşteri bulunamadı." });

    let interactions;
    if (interactionIds && interactionIds.length > 0) {
      interactions = await db.select().from(interactionRecordsTable)
        .where(and(
          inArray(interactionRecordsTable.id, interactionIds.map(Number)),
          eq(interactionRecordsTable.excludedFromAnalysis, false)
        ));
    } else {
      interactions = await db.select().from(interactionRecordsTable)
        .where(and(
          eq(interactionRecordsTable.customerId, Number(customerId)),
          eq(interactionRecordsTable.excludedFromAnalysis, false)
        ))
        .orderBy(desc(interactionRecordsTable.interactedAt))
        .limit(20);
    }

    if (!interactions.length) {
      return res.status(400).json({ error: "Bu müşteri için hariç tutulmayan etkileşim kaydı bulunamadı." });
    }

    const cust = customer[0];
    const interactionText = interactions.map((i, idx) =>
      `[ID:${i.id}] Tür: ${i.type} | Konu: ${i.subject} | Durum: ${i.status} | Kanal: ${i.channel}
İçerik: ${i.content}${i.resolution ? `\nÇözüm: ${i.resolution}` : ""}`
    ).join("\n\n");

    const prompt = `Sen bir müşteri deneyimi (CX) uzmanı yapay zekasısın. Aşağıdaki B2B müşteri etkileşim geçmişini analiz et ve JSON formatında sonuç döndür.

MÜŞTERİ BİLGİLERİ:
- Ad: ${cust.name}
- Firma: ${cust.company || cust.segment || "Bilinmiyor"}
- Mevcut NPS Skoru: ${cust.npsScore ?? "Bilinmiyor"}

ETKİLEŞİM GEÇMİŞİ (${interactions.length} kayıt):
${interactionText}

GÖREV: Bu etkileşimlere dayanarak aşağıdaki analizi JSON formatında döndür:

{
  "predictedNps": <0-10 arası tahmin edilen NPS skoru, ondalıklı>,
  "predictedCsat": <1-5 arası tahmin edilen CSAT skoru, ondalıklı>,
  "overallSentiment": <"positive" | "neutral" | "negative">,
  "churnRisk": <"low" | "medium" | "high">,
  "painPoints": [<en fazla 5 acı nokta, Türkçe kısa cümle>],
  "keyTopics": [<en fazla 7 konu etiketi — kısa, tek veya iki kelimelik Türkçe etiketler. Örnek: "Fatura Sorunu", "Teknik Arıza", "Yanıt Gecikmesi", "UI/UX", "Entegrasyon", "E-posta">],
  "interactionTags": {
    "<interaction_id>": [<2-4 kısa Türkçe etiket, bu spesifik etkileşimi tanımlayan>]
  },
  "summary": <100-150 kelime Türkçe özet: müşteri deneyimi değerlendirmesi>,
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
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try {
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = {};
    }

    // Update interaction tags
    if (parsed.interactionTags && typeof parsed.interactionTags === "object") {
      for (const [idStr, tags] of Object.entries(parsed.interactionTags)) {
        const id = Number(idStr);
        if (id && Array.isArray(tags)) {
          await db.update(interactionRecordsTable)
            .set({ tags: tags as string[] })
            .where(eq(interactionRecordsTable.id, id));
        }
      }
    }

    const [analysis] = await db.insert(cxAnalysesTable).values({
      customerId: Number(customerId),
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
    }).returning();

    await db.update(customersTable).set({
      npsScore: parsed.predictedNps ?? cust.npsScore,
      sentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment) ? parsed.overallSentiment : cust.sentiment,
      churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk) ? parsed.churnRisk : cust.churnRisk,
      lastInteraction: new Date(),
    }).where(eq(customersTable.id, Number(customerId)));

    await db.insert(auditLogsTable).values({
      action: "CX_ANALYSIS",
      entityType: "cx_analyses",
      entityId: analysis.id,
      userId: "system",
      details: `Gemini CX analizi: ${cust.name} (${cust.company || cust.segment}), NPS: ${parsed.predictedNps}, CSAT: ${parsed.predictedCsat}, Churn: ${parsed.churnRisk}`,
      piiMasked: false,
    });

    res.status(201).json({ ...analysis, createdAt: analysis.createdAt.toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── BULK ANALYZE — analyze multiple customers sequentially ──────────────────
router.post("/cx-analyses/bulk-analyze", async (req, res) => {
  const { customerIds } = req.body as { customerIds: number[] };
  if (!customerIds?.length) return res.status(400).json({ error: "customerIds zorunludur." });

  res.json({ message: "Toplu analiz başlatıldı.", total: customerIds.length });

  // Fire-and-forget — analyze in the background
  (async () => {
    for (const customerId of customerIds) {
      try {
        // Check if customer has interactions
        const interactions = await db.select({ id: interactionRecordsTable.id })
          .from(interactionRecordsTable)
          .where(and(
            eq(interactionRecordsTable.customerId, customerId),
            eq(interactionRecordsTable.excludedFromAnalysis, false)
          ))
          .limit(1);
        if (!interactions.length) continue;

        const cust = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
        if (!cust.length) continue;

        const allInteractions = await db.select().from(interactionRecordsTable)
          .where(and(
            eq(interactionRecordsTable.customerId, customerId),
            eq(interactionRecordsTable.excludedFromAnalysis, false)
          ))
          .orderBy(desc(interactionRecordsTable.interactedAt))
          .limit(20);

        const customer = cust[0];
        const interactionText = allInteractions.map((i) =>
          `[ID:${i.id}] Tür: ${i.type} | Konu: ${i.subject} | Durum: ${i.status}
İçerik: ${i.content}${i.resolution ? `\nÇözüm: ${i.resolution}` : ""}`
        ).join("\n\n");

        const prompt = `Sen bir müşteri deneyimi uzmanısın. Aşağıdaki B2B müşteri etkileşimlerini analiz et ve JSON döndür.
Müşteri: ${customer.name} | Firma: ${customer.company || customer.segment}

ETKİLEŞİMLER (${allInteractions.length} adet):
${interactionText}

JSON formatı:
{
  "predictedNps": <0-10>,
  "predictedCsat": <1-5>,
  "overallSentiment": <"positive"|"neutral"|"negative">,
  "churnRisk": <"low"|"medium"|"high">,
  "painPoints": [<en fazla 4 acı nokta Türkçe>],
  "keyTopics": [<en fazla 6 kısa Türkçe etiket>],
  "interactionTags": { "<id>": [<2-3 kısa Türkçe etiket>] },
  "summary": <80-100 kelime Türkçe özet>,
  "recommendations": <50-80 kelime Türkçe öneriler>
}

Etkileşim ID'leri: ${allInteractions.map(i => i.id).join(", ")}
Sadece JSON döndür.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 2048 },
        });

        const raw = response.text?.trim() ?? "{}";
        // Try multiple strategies to extract JSON from Gemini response
        let parsed: any = {};
        try {
          // Strategy 1: find largest JSON block
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch {
          try {
            // Strategy 2: strip markdown code blocks then parse
            const stripped = raw.replace(/```(?:json)?/gi, "").trim();
            const jsonMatch2 = stripped.match(/\{[\s\S]*\}/);
            if (jsonMatch2) parsed = JSON.parse(jsonMatch2[0]);
          } catch { parsed = {}; }
        }
        // Ensure NPS/CSAT are numbers (Gemini sometimes returns strings)
        if (typeof parsed.predictedNps === "string") parsed.predictedNps = parseFloat(parsed.predictedNps);
        if (typeof parsed.predictedCsat === "string") parsed.predictedCsat = parseFloat(parsed.predictedCsat);
        if (isNaN(parsed.predictedNps)) parsed.predictedNps = null;
        if (isNaN(parsed.predictedCsat)) parsed.predictedCsat = null;

        // Update interaction tags
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
          interactionIds: allInteractions.map(i => i.id),
          model: "gemini-2.5-flash",
        });

        await db.update(customersTable).set({
          npsScore: parsed.predictedNps ?? customer.npsScore,
          sentiment: ["positive", "neutral", "negative"].includes(parsed.overallSentiment) ? parsed.overallSentiment : customer.sentiment,
          churnRisk: ["low", "medium", "high"].includes(parsed.churnRisk) ? parsed.churnRisk : customer.churnRisk,
          lastInteraction: new Date(),
        }).where(eq(customersTable.id, customerId));

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        console.error(`Bulk analyze error for customer ${customerId}:`, e);
      }
    }

    console.log(`Bulk analysis completed for ${customerIds.length} customers.`);
  })();
});

// ─── BULK ANALYZE STATUS — poll how many analyses exist for given customer IDs
router.post("/cx-analyses/bulk-status", async (req, res) => {
  const { customerIds } = req.body as { customerIds: number[] };
  if (!customerIds?.length) return res.json({ done: 0, total: 0 });

  const rows = await db
    .select({ customerId: cxAnalysesTable.customerId })
    .from(cxAnalysesTable)
    .where(inArray(cxAnalysesTable.customerId, customerIds));

  const analyzed = new Set(rows.map(r => r.customerId)).size;
  res.json({ done: analyzed, total: customerIds.length });
});

export default router;
