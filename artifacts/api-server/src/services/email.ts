/**
 * E-posta Servisi
 *
 * Şu an: Resend API kullanıyor.
 *
 * Firebase Trigger Email'e geçmek için:
 *   1. Bu dosyadaki `sendEmail` fonksiyonunu güncelleyin.
 *   2. Resend yerine Firestore'a `mail` collection'ına belge yazın:
 *
 *      await adminDb.collection("mail").add({
 *        to: [options.to],
 *        message: {
 *          subject: options.subject,
 *          html: options.html,
 *        },
 *      });
 *
 *   3. Başka hiçbir dosyada değişiklik gerekmez.
 */

import { Resend } from "resend";

const FROM_ADDRESS = "CX-Inn Platform <noreply@infoset.app>";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY tanımlı değil — e-posta gönderimi atlandı");
    return { success: false, error: "E-posta servisi yapılandırılmamış" };
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [options.to],
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    console.error("[email] Resend hatası:", error);
    return { success: false, error: error.message };
  }

  console.log(`[email] Gönderildi → ${options.to}`);
  return { success: true };
}
