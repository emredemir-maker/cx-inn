import { Router } from "express";
import { db } from "@workspace/db";
import { surveyTestSendsTable, surveysTable, surveyResponsesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ── HTML email builder (mirror of frontend surveys.tsx logic) ─────────────────

function buildEmailHtml(survey: any, surveyUrl: string): string {
  const design = survey.emailDesign ?? {};
  const brandColor = design.brandColor ?? "#6366f1";
  const bgColor = design.bgColor ?? "#0f172a";
  const textColor = design.textColor ?? "#e2e8f0";
  const companyName = design.companyName ?? "CX-Inn";
  const headline = design.headline ?? (
    survey.type === "NPS" ? "Bizi arkadaşlarınıza önerir misiniz?" :
    survey.type === "CSAT" ? "Deneyiminizi nasıl değerlendirirsiniz?" :
    "Çözüm ne kadar kolaydı?"
  );
  const subheadline = design.subheadline ?? "Geri bildiriminiz bizim için çok değerli.";
  const footerNote = design.footerNote ?? "Bu e-posta bir test gönderimdir.";

  const typeLabel = survey.type === "NPS" ? "Net Promoter Score (0–10)"
    : survey.type === "CSAT" ? "Müşteri Memnuniyeti (1–5)"
    : "Müşteri Efor Skoru (1–7)";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
  <!-- Header -->
  <tr><td style="background:${brandColor};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${companyName}</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">🧪 TEST GÖNDERİMİ — Gerçek veri sayılmaz</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 12px;color:${textColor};font-size:22px;font-weight:700;line-height:1.3;">${headline}</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">${subheadline}</p>
    <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Anket Türü</p>
    <p style="margin:0 0 28px;color:${textColor};font-size:14px;">${typeLabel}</p>
    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0"><tr><td>
      <a href="${surveyUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.01em;">
        Anketi Doldur →
      </a>
    </td></tr></table>
    <p style="margin:20px 0 0;color:#475569;font-size:12px;">Yukarıdaki butona tıklayın veya şu bağlantıyı kullanın:<br/>
      <a href="${surveyUrl}" style="color:${brandColor};word-break:break-all;">${surveyUrl}</a>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 32px;border-top:1px solid #334155;">
    <p style="margin:0;color:#475569;font-size:12px;">${footerNote}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// POST /api/surveys/:surveyId/test-send
router.post("/surveys/:surveyId/test-send", async (req, res) => {
  try {
    const surveyId = parseInt(req.params.surveyId);
    const { email } = req.body as { email: string };

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Geçerli bir e-posta adresi giriniz." });
    }

    const [survey] = await db.select().from(surveysTable).where(eq(surveysTable.id, surveyId));
    if (!survey) return res.status(404).json({ error: "Anket bulunamadı." });

    const token = randomUUID();
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:${process.env.PORT ?? 8080}`;
    const surveyUrl = `${baseUrl}/survey/${token}`;

    // Store test send record
    await db.insert(surveyTestSendsTable).values({
      surveyId,
      email,
      token,
      status: "sent",
      sentAt: new Date(),
    });

    // Try sending email via Resend
    let emailSent = false;
    let emailError = "";

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const htmlContent = buildEmailHtml(survey, surveyUrl);
        const sendResult = await resend.emails.send({
          from: `CX-Inn Test <onboarding@resend.dev>`,
          to: [email],
          subject: `[TEST] ${survey.title} — ${survey.type} Anketi`,
          html: htmlContent,
        });
        if (sendResult.error) {
          emailError = sendResult.error.message ?? "E-posta gönderilemedi.";
        } else {
          emailSent = true;
        }
      } catch (e: any) {
        emailError = e.message ?? "E-posta gönderiminde hata.";
      }
    } else {
      emailError = "RESEND_API_KEY yapılandırılmamış. Anket bağlantısını manuel kullanabilirsiniz.";
    }

    res.json({
      success: true,
      emailSent,
      emailError: emailSent ? null : emailError,
      surveyUrl,
      token,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/surveys/:surveyId/test-sends  — list all test sends for a survey
router.get("/surveys/:surveyId/test-sends", async (req, res) => {
  try {
    const surveyId = parseInt(req.params.surveyId);
    const sends = await db
      .select()
      .from(surveyTestSendsTable)
      .where(eq(surveyTestSendsTable.surveyId, surveyId))
      .orderBy(surveyTestSendsTable.sentAt);
    res.json(sends);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/survey/token/:token  — public: get survey details for respondent page
router.get("/survey/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [testSend] = await db
      .select()
      .from(surveyTestSendsTable)
      .where(eq(surveyTestSendsTable.token, token));

    if (!testSend) return res.status(404).json({ error: "Geçersiz veya süresi dolmuş bağlantı." });
    if (testSend.status === "completed") {
      return res.json({ alreadyCompleted: true, survey: null });
    }

    const [survey] = await db.select().from(surveysTable).where(eq(surveysTable.id, testSend.surveyId));
    if (!survey) return res.status(404).json({ error: "Anket bulunamadı." });

    // Mark as viewed
    if (testSend.status === "sent") {
      await db
        .update(surveyTestSendsTable)
        .set({ status: "viewed", viewedAt: new Date() })
        .where(eq(surveyTestSendsTable.token, token));
    }

    res.json({
      alreadyCompleted: false,
      survey: { id: survey.id, title: survey.title, type: survey.type, emailDesign: survey.emailDesign },
      testSendId: testSend.id,
      email: testSend.email,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/survey/token/:token/respond  — public: submit test response
router.post("/survey/token/:token/respond", async (req, res) => {
  try {
    const { token } = req.params;
    const { score, feedback } = req.body as { score: number; feedback?: string };

    const [testSend] = await db
      .select()
      .from(surveyTestSendsTable)
      .where(eq(surveyTestSendsTable.token, token));

    if (!testSend) return res.status(404).json({ error: "Geçersiz bağlantı." });
    if (testSend.status === "completed") return res.status(400).json({ error: "Bu anket zaten doldurulmuş." });

    const sentiment = score >= 8 ? "positive" : score >= 5 ? "neutral" : "negative";

    // Save as test response (is_test = true — does NOT affect real analytics)
    await db.insert(surveyResponsesTable).values({
      surveyId: testSend.surveyId,
      score,
      feedback: feedback ?? null,
      sentiment,
      isTest: true,
      respondedAt: new Date(),
    });

    // Update test send record
    await db
      .update(surveyTestSendsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        score: String(score),
        feedback: feedback ?? null,
      })
      .where(eq(surveyTestSendsTable.token, token));

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
