import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable, interactionRecordsTable, surveysTable, segmentsTable,
} from "@workspace/db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

// ── Fetch customers for a target group key ─────────────────────────────────────

const notExcluded = eq(customersTable.isExcluded, false);

async function getCustomersForTarget(targetKey: string, limit = 12) {
  if (targetKey === "all") {
    return db.select().from(customersTable).where(notExcluded).limit(limit);
  }

  if (targetKey.startsWith("seg_")) {
    const segId = parseInt(targetKey.replace("seg_", ""), 10);
    const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, segId));
    if (!seg) return [];

    // Segment membership = customers who have interactions tagged with ANY of the segment's sourceTags
    if (!seg.sourceTags || seg.sourceTags.length === 0) return [];

    const tagList = seg.sourceTags.map((t) => sql`${t}`);
    const rows = await db.execute<{ id: number }>(sql`
      SELECT DISTINCT c.id
      FROM customers c
      JOIN interaction_records ir ON ir.customer_id = c.id
      WHERE c.is_excluded = false
        AND ir.tags && ARRAY[${sql.join(tagList, sql`, `)}]::text[]
      LIMIT ${limit}
    `);

    const ids: number[] = ((rows as any).rows ?? rows as any[]).map((r: any) => Number(r.id)).filter(Boolean);
    if (ids.length === 0) return [];
    return db.select().from(customersTable).where(and(notExcluded, inArray(customersTable.id, ids)));
  }

  if (targetKey === "high_churn")        return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "high"))).limit(limit);
  if (targetKey === "mid_churn")         return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "medium"))).limit(limit);
  if (targetKey === "low_churn")         return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "low"))).limit(limit);
  if (targetKey === "sentiment_positive") return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.sentiment, "positive"))).limit(limit);
  if (targetKey === "sentiment_neutral")  return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.sentiment, "neutral"))).limit(limit);
  if (targetKey === "sentiment_negative") return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.sentiment, "negative"))).limit(limit);

  return db.select().from(customersTable).where(notExcluded).limit(limit);
}

// POST /api/campaigns/ai-personalize
router.post("/campaigns/ai-personalize", async (req, res) => {
  try {
    const { surveyId, targetKey, companyName = "CX-Inn", surveyType = "NPS" } = req.body as {
      surveyId?: number;
      targetKey: string;
      companyName?: string;
      surveyType?: string;
    };

    // 1. Get survey info
    let survey: any = null;
    if (surveyId) {
      [survey] = await db.select().from(surveysTable).where(eq(surveysTable.id, surveyId));
    }
    const sType = survey?.type ?? surveyType;
    const sTitle = survey?.title ?? "Anket";

    // 2. Get customers via correct membership logic
    const customers = await getCustomersForTarget(targetKey, 12);
    if (!customers.length) {
      return res.status(400).json({ error: "Bu segment için müşteri bulunamadı. Segmentin kaynak etiketleri ile eşleşen müşteri kaydı yok." });
    }

    // 3. Fetch last 3 interaction_records for each customer (the actual rich records)
    const customerIds = customers.map((c) => c.id);
    const interactions = await db
      .select()
      .from(interactionRecordsTable)
      .where(inArray(interactionRecordsTable.customerId, customerIds))
      .orderBy(desc(interactionRecordsTable.interactedAt));

    const interactionMap: Record<number, typeof interactions> = {};
    for (const i of interactions) {
      if (!i.customerId) continue;
      if (!interactionMap[i.customerId]) interactionMap[i.customerId] = [];
      if (interactionMap[i.customerId].length < 3) interactionMap[i.customerId].push(i);
    }

    // 4. Build Gemini prompt (batch all customers in one call)
    const customerProfiles = customers.map((c) => {
      const ints = interactionMap[c.id] ?? [];
      const intSummary = ints.length
        ? ints.map((i) => `[${i.channel}/${i.type}] Konu:${i.subject ?? "-"} Durum:${i.status ?? "-"}${i.tags?.length ? " Etiketler:" + i.tags.join(",") : ""}`).join("; ")
        : "geçmiş etkileşim yok";
      return `ID:${c.id} | Ad:${c.name} | ChurnRisk:${c.churnRisk ?? "bilinmiyor"} | NPS:${c.npsScore ?? "bilinmiyor"} | Duygu:${c.sentiment ?? "bilinmiyor"} | Etkileşimler: ${intSummary}`;
    });

    const surveyTypeLabel = sType === "NPS" ? "Net Promoter Score (0–10)"
      : sType === "CSAT" ? "Müşteri Memnuniyet (1–5)"
      : "Müşteri Efor Skoru (1–7)";

    const prompt = `Sen bir B2B CX (Müşteri Deneyimi) uzmanısın. Aşağıdaki ${customers.length} müşteri için hiper-kişiselleştirilmiş Türkçe e-posta anket davet metni yaz.

Anket: "${sTitle}" (${surveyTypeLabel})
Şirket: ${companyName}

Müşteri profilleri:
${customerProfiles.join("\n")}

Her müşteri için şunları oluştur:
1. subject: Kişiselleştirilmiş e-posta konu satırı (max 60 karakter, emoji yok)
2. greeting: Kişisel selamlama (1 cümle, müşteri adını kullan)
3. headline: E-postanın ana başlığı (max 70 karakter)
4. subheadline: Neden önemli olduğunu açıklayan 1-2 cümle (müşterinin durumuna göre)
5. cta: CTA buton metni (max 30 karakter)
6. tone_note: Kullandığın ton (1-3 kelime, örn: "samimi, acil" veya "kurumsal, saygılı")

Kurallar:
- Churn riski YÜKSEK müşteriler için: empati, geri kazanma tonu, kişisel değer hissi
- Churn riski DÜŞÜK/NPS Promoter: takdir, topluluk, elçi dili
- Negatif sentiment: sorun çözme, iyileştirme vurgusu
- Pozitif sentiment: başarıyı kutla, referans iste
- MAX 1 soru işareti kullan

Yanıtı SADECE şu JSON formatında ver:
{
  "personalized": [
    {
      "customerId": <number>,
      "subject": "...",
      "greeting": "...",
      "headline": "...",
      "subheadline": "...",
      "cta": "...",
      "tone_note": "..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.7 },
    });

    const raw = response.text ?? "";

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Strip markdown fences and retry
      const stripped = raw.replace(/```(?:json)?/gi, "").trim();
      const m = stripped.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    if (!parsed?.personalized) {
      return res.status(500).json({ error: "Gemini yanıtı işlenemedi.", raw: raw.slice(0, 500) });
    }

    // Merge customer info into results
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const results = parsed.personalized.map((p: any) => {
      const c = customerMap[p.customerId] ?? {};
      return {
        ...p,
        customerName: c.name ?? "Müşteri",
        customerEmail: c.email ?? null,
        segment: c.segment ?? "-",
        churnRisk: c.churnRisk ?? "low",
        npsScore: c.npsScore ?? null,
      };
    });

    res.json({ results, total: customers.length });
  } catch (e: any) {
    console.error("[ai-personalize]", e);
    res.status(500).json({ error: e.message ?? String(e) });
  }
});

// POST /api/campaigns/ai-segment-recommend
router.post("/campaigns/ai-segment-recommend", async (req, res) => {
  try {
    const { surveyType = "NPS", surveyTitle = "Anket" } = req.body as {
      surveyType?: string;
      surveyTitle?: string;
    };

    const segments = await db.select({
      id: segmentsTable.id,
      name: segmentsTable.name,
      description: segmentsTable.description,
      customerCount: segmentsTable.customerCount,
      avgNps: segmentsTable.avgNps,
    }).from(segmentsTable);

    const standardGroups = [
      { key: "all",                label: "Tüm Müşteriler",        desc: "Tüm aktif müşteriler" },
      { key: "high_churn",         label: "Yüksek Churn Riskli",   desc: "Kayıp riski yüksek müşteriler" },
      { key: "mid_churn",          label: "Orta Churn Riskli",     desc: "Orta kayıp riski taşıyanlar" },
      { key: "low_churn",          label: "Düşük Churn Riskli",    desc: "Memnun, düşük riskli müşteriler" },
      { key: "sentiment_positive", label: "Pozitif Duygu",         desc: "Olumlu deneyim yaşayanlar" },
      { key: "sentiment_negative", label: "Negatif Duygu",         desc: "Olumsuz deneyim yaşayanlar" },
    ];

    const allGroups = [
      ...standardGroups.map(g => `Anahtar:"${g.key}" | Ad:"${g.label}" | ${g.desc}`),
      ...segments.map(s => `Anahtar:"seg_${s.id}" | Ad:"${s.name}" | ${s.customerCount ?? 0} müşteri | OrtNPS:${s.avgNps ?? "?"} | ${s.description ?? ""}`),
    ].join("\n");

    const purpose = surveyType === "NPS"
      ? "Müşterilerin markayı tavsiye etme olasılığını ölçer (0-10). Promoter, Passive ve Detractor gruplarını belirlemek için kullanılır."
      : surveyType === "CSAT"
      ? "Belirli bir etkileşim veya deneyimdeki anlık memnuniyeti ölçer (1-5)."
      : "Bir sorunu çözmenin ne kadar kolay olduğunu ölçer (1-7). Yüksek efor = düşük sadakat.";

    const prompt = `Sen bir B2B CX stratejisti yapay zekasısın.

Anket: "${surveyTitle}" — Tür: ${surveyType}
Amaç: ${purpose}

Mevcut hedef gruplar:
${allGroups}

Bu anket türü ve başlığı için en uygun 3 hedef grubu seç.
Her seçim için kısa bir gerekçe yaz (max 15 kelime, Türkçe).

JSON yanıt:
{"recommendations":[{"targetKey":"...","targetName":"...","reason":"...","priority":1}]}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text?.trim() ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.replace(/```(?:json)?/gi, "").trim().match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    res.json({ recommendations: parsed.recommendations ?? [] });
  } catch (err: any) {
    console.error("[ai-segment-recommend]", err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

export default router;
