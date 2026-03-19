/**
 * E-posta Servisi — Gmail SMTP (Nodemailer)
 *
 * Kurulum:
 *   1. Google Hesabınızda 2 Adımlı Doğrulama açık olmalı
 *   2. https://myaccount.google.com/apppasswords → "Mail" için uygulama şifresi oluşturun
 *   3. .env dosyasına ekleyin:
 *        GMAIL_USER=sizin@gmail.com
 *        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 */

import nodemailer from "nodemailer";

const FROM_ADDRESS = `CX-Inn Platform <${process.env.GMAIL_USER}>`;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("[email] GMAIL_USER veya GMAIL_APP_PASSWORD tanımlı değil — e-posta gönderimi atlandı");
    return { success: false, error: "E-posta servisi yapılandırılmamış" };
  }

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[email] Gönderildi → ${options.to}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Gmail hatası:", message);
    return { success: false, error: message };
  }
}
