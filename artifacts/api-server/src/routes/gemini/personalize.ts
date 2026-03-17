import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable as customersTable, surveysTable, aiApprovalsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { PersonalizeTextBody } from "@workspace/api-zod";

const router: IRouter = Router();

const TONE_DESCRIPTIONS: Record<string, string> = {
  formal: "Resmi ve kurumsal ton. Saygılı, profesyonel hitap. 'Sayın' ifadesi kullanılabilir.",
  empathetic: "Empatik ve anlayışlı ton. Müşterinin duygularını ve deneyimlerini ön plana çıkar. Sıcak ve destekleyici bir dil kullan.",
  friendly: "Samimi ve dostane ton. Müşteriyle sıcak bir bağ kur. Kişisel hitap, hevesli ama profesyonel.",
};

const SENTIMENT_CONTEXT: Record<string, string> = {
  positive: "Müşteri olumlu bir ruh halinde. Memnuniyetini pekiştirmek ve teşekkür etmek için fırsat.",
  neutral: "Müşteri nötr bir ruh halinde. Nazik ve dengeli bir yaklaşım uygun.",
  negative: "Müşteri olumsuz bir deneyim yaşamış. Özür ve empatiyle yaklaşılmalı, çözüm odaklı olunmalı.",
};

const CHURN_CONTEXT: Record<string, string> = {
  low: "Müşteri sadık. Normal geri bildirim sürecine odaklan.",
  medium: "Müşteri terk riski taşıyor. Değer hissettirmeye özen göster.",
  high: "Müşteri yüksek terk riski taşıyor. Özellikle önemsediğini ve değer verdiğini hissettir.",
};

router.post("/ai/personalize", async (req, res) => {
  try {
    const body = PersonalizeTextBody.parse(req.body);

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, body.customerId));
    if (!customer) return res.status(404).json({ error: "Müşteri bulunamadı" });

    const [survey] = await db.select().from(surveysTable).where(eq(surveysTable.id, body.surveyId));
    if (!survey) return res.status(404).json({ error: "Anket bulunamadı" });

    const prompt = `Sen bir müşteri deneyimi (CX) uzmanısın. Verilen müşteri profili ve anket şablonunu kullanarak kişiselleştirilmiş bir Türkçe mesaj yaz.

MÜŞTERİ PROFİLİ:
- Ad: ${customer.name}
- Segment: ${customer.segment}
- Son NPS Skoru: ${customer.npsScore ?? "Mevcut değil"}
- Psikolojik Durum: ${SENTIMENT_CONTEXT[customer.sentiment]}
- Terk Riski: ${CHURN_CONTEXT[customer.churnRisk]}

ANKET BİLGİSİ:
- Anket Adı: ${survey.title}
- Anket Türü: ${survey.type}
- Kanal: ${body.channel}

KULLANILACAK TON: ${TONE_DESCRIPTIONS[body.tone]}

ŞABLON METİN:
"${body.originalText}"

GÖREV: Yukarıdaki şablon metni, müşteri profiline ve belirtilen tona göre kişiselleştir. Yalnızca kişiselleştirilmiş metni yaz, başka bir açıklama ekleme. Metin 2-4 cümle olsun. Türkçe yaz.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });

    const personalizedText = response.text?.trim() ?? body.originalText;

    const [approval] = await db.insert(aiApprovalsTable).values({
      surveyId: body.surveyId,
      customerId: body.customerId,
      customerName: customer.name.replace(/(?<=.{2}).(?=.{2})/g, "*"),
      channel: body.channel,
      toneUsed: body.tone,
      originalText: body.originalText,
      personalizedText,
      status: "pending",
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "AI_GENERATE",
      entityType: "ai_approval",
      entityId: approval.id,
      userId: "gemini-ai",
      details: `Gemini AI ile kişiselleştirilmiş metin oluşturuldu (müşteri: ${customer.segment}, ton: ${body.tone})`,
      piiMasked: true,
    });

    res.json({ ...approval, createdAt: approval.createdAt.toISOString() });
  } catch (err) {
    console.error("AI personalization error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
