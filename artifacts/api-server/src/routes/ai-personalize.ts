import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable, interactionsTable, surveysTable, segmentsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

// ── Fetch customers for a target group key ─────────────────────────────────────

const notExcluded = eq(customersTable.isExcluded, false);

async function getCustomersForTarget(targetKey: string, limit = 12) {
  if (targetKey === "all") {
    return db.select().from(customersTable).where(notExcluded).limit(limit);
  }
  if (targetKey.startsWith("seg_")) {
    const segId = parseInt(targetKey.replace("seg_", ""));
    const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, segId));
    if (!seg) return [];
    return db.select().from(customersTable)
      .where(and(notExcluded, eq(customersTable.segment, seg.name)))
      .limit(limit);
  }
  if (targetKey === "high_churn")   return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "high"))).limit(limit);
  if (targetKey === "mid_churn")    return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "medium"))).limit(limit);
  if (targetKey === "low_churn")    return db.select().from(customersTable).where(and(notExcluded, eq(customersTable.churnRisk, "low"))).limit(limit);
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

    // 2. Get customers
    const customers = await getCustomersForTarget(targetKey, 12);
    if (!customers.length) {
      return res.status(400).json({ error: "Bu segment için müşteri bulunamadı." });
    }

    // 3. Fetch last 3 interactions for each customer
    const customerIds = customers.map((c) => c.id);
    const interactions = await db
      .select()
      .from(interactionsTable)
      .where(inArray(interactionsTable.customerId, customerIds))
      .orderBy(desc(interactionsTable.createdAt));

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
        ? ints.map((i) => `[${i.channel}/${i.sentiment}]${i.issue ? ": " + i.issue : ""}`).join("; ")
        : "geçmiş etkileşim yok";
      return `ID:${c.id} | Ad:${c.name} | Segment:${c.segment} | ChurnRisk:${c.churnRisk} | NPS:${c.npsScore ?? "bilinmiyor"} | Etkileşimler: ${intSummary}`;
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
4. subheadline: Neden önemli olduğunu açıklayan 1-2 cümle (müşterinin segmenti/durumuna göre)
5. cta: CTA buton metni (max 30 karakter)
6. tone_note: Kullandığın ton (1-3 kelime, örn: "samimi, acil" veya "kurumsal, saygılı")

Kurallar:
- Churn riski YÜKSEK müşteriler için: empati, geri kazanma tonu, kişisel değer hissi
- Churn riski DÜŞÜK/NPS Promoter: takdir, topluluk, elçi dili
- Negatif sentiment: sorun çözme, iyileştirme vurgusu
- Pozitif sentiment: başarıyı kutla, referans iste
- MAX 1 soru işareti kullan

Yanıtı SADECE şu JSON formatında ver, başka metin ekleme:
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
      config: { thinkingBudget: 0, maxOutputTokens: 8192, temperature: 0.7 },
    });

    const raw = response.text ?? "";

    // Extract JSON — strip markdown fences first
    let jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // If still wrapped, pull out the object
    if (!jsonStr.startsWith("{")) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      jsonStr = m ? m[0] : jsonStr;
    }

    let parsed: any = null;
    try { parsed = JSON.parse(jsonStr); } catch (parseErr) {
      // Last resort: try regex extraction
      const m2 = raw.match(/\{[\s\S]*\}/);
      if (m2) { try { parsed = JSON.parse(m2[0]); } catch {} }
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

export default router;
