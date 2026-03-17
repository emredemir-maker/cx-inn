import { Router, type IRouter, type Request, type Response } from "express";
import { db, invitationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";
import { sendEmail } from "../services/email";

const router: IRouter = Router();

const PLATFORM_URL = process.env.PLATFORM_URL
  ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "cx-inn.replit.app"}`;

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Süper Admin",
  cx_manager: "CX Manager",
  cx_user: "CX Kullanıcısı",
};

function buildInviteEmailHtml(email: string, role: string, inviterName: string): string {
  const roleName = ROLE_LABELS[role] ?? role;
  const loginUrl = `${PLATFORM_URL}/login`;

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CX-Inn Davet</title>
</head>
<body style="margin:0;padding:0;background:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1521;border:1px solid #1e2a3a;border-radius:16px;overflow:hidden;">

          <tr>
            <td style="background:linear-gradient(135deg,#1a1f3a 0%,#0f1521 100%);padding:32px 40px 28px;border-bottom:1px solid #1e2a3a;">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">CX-Inn</span>
              <span style="color:#64748b;font-size:13px;margin-left:8px;">B2B CX Platformu</span>
            </td>
          </tr>

          <tr>
            <td style="padding:40px;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 12px;line-height:1.3;">
                Platforma davet edildiniz 🎉
              </h1>
              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
                <strong style="color:#e2e8f0;">${inviterName}</strong> sizi
                <strong style="color:#6366f1;">CX-Inn</strong> platformuna
                <strong style="color:#e2e8f0;">${roleName}</strong> rolüyle davet etti.
              </p>

              <div style="background:#1e2a3a;border:1px solid #2d3f55;border-radius:12px;padding:16px 20px;margin-bottom:32px;display:inline-block;">
                <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Atanan Rol</p>
                <p style="color:#a5b4fc;font-size:16px;font-weight:600;margin:0;">${roleName}</p>
              </div>

              <div style="text-align:center;margin-bottom:32px;">
                <a href="${loginUrl}"
                   style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:600;">
                  Google ile Giriş Yap
                </a>
              </div>

              <p style="color:#475569;font-size:13px;line-height:1.6;margin:0 0 8px;">
                Bağlantı: <a href="${loginUrl}" style="color:#6366f1;text-decoration:none;">${loginUrl}</a>
              </p>
              <p style="color:#334155;font-size:12px;line-height:1.6;margin:0;">
                <strong style="color:#475569;">${email}</strong> adresiyle bağlı Google hesabınızla giriş yapmanız yeterli — rol otomatik atanır.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#0a0f1a;border-top:1px solid #1e2a3a;padding:20px 40px;">
              <p style="color:#334155;font-size:12px;margin:0;text-align:center;">
                CX-Inn Platform · Bu e-postayı yanlışlıkla aldıysanız görmezden gelebilirsiniz.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// List all invitations (superadmin only)
router.get(
  "/invitations",
  requireRole("superadmin"),
  async (_req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(invitationsTable)
      .orderBy(invitationsTable.createdAt);
    res.json(rows);
  },
);

// Create invitation (superadmin only)
router.post(
  "/invitations",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { email, role } = req.body as { email?: string; role?: string };
    const reqUser = req.user as { id: string; firstName?: string; lastName?: string; email?: string };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Geçerli bir e-posta adresi girin" });
      return;
    }

    const validRoles = ["superadmin", "cx_manager", "cx_user"];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: "Geçersiz rol" });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existing) {
      res.status(409).json({ error: "Bu e-posta adresi zaten kayıtlı bir kullanıcıya ait" });
      return;
    }

    try {
      const [invitation] = await db
        .insert(invitationsTable)
        .values({
          email: email.toLowerCase(),
          role: role as "superadmin" | "cx_manager" | "cx_user",
          invitedBy: reqUser.id,
        })
        .onConflictDoUpdate({
          target: invitationsTable.email,
          set: {
            role: role as "superadmin" | "cx_manager" | "cx_user",
            invitedBy: reqUser.id,
            accepted: false,
            acceptedAt: null,
            createdAt: new Date(),
          },
        })
        .returning();

      const inviterName =
        [reqUser.firstName, reqUser.lastName].filter(Boolean).join(" ") ||
        reqUser.email ||
        "CX-Inn Yöneticisi";

      const emailResult = await sendEmail({
        to: email.toLowerCase(),
        subject: `CX-Inn platformuna davet edildiniz — ${ROLE_LABELS[role] ?? role}`,
        html: buildInviteEmailHtml(email.toLowerCase(), role, inviterName),
      });

      res.json({ ...invitation, emailSent: emailResult.success, emailError: emailResult.error });
    } catch (err) {
      console.error("[invitations] Oluşturma hatası:", err);
      res.status(500).json({ error: "Davet oluşturulamadı" });
    }
  },
);

// Resend invitation email (superadmin only)
router.post(
  "/invitations/:id/resend",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const reqUser = req.user as { id: string; firstName?: string; lastName?: string; email?: string };

    const [invitation] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, Number(id)));

    if (!invitation) {
      res.status(404).json({ error: "Davet bulunamadı" });
      return;
    }

    if (invitation.accepted) {
      res.status(400).json({ error: "Bu davet zaten kabul edildi" });
      return;
    }

    const inviterName =
      [reqUser.firstName, reqUser.lastName].filter(Boolean).join(" ") ||
      reqUser.email ||
      "CX-Inn Yöneticisi";

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: `CX-Inn platformuna davet edildiniz — ${ROLE_LABELS[invitation.role] ?? invitation.role}`,
      html: buildInviteEmailHtml(invitation.email, invitation.role, inviterName),
    });

    if (!emailResult.success) {
      res.status(500).json({ error: emailResult.error ?? "E-posta gönderilemedi" });
      return;
    }

    res.json({ success: true });
  },
);

// Delete invitation (superadmin only)
router.delete(
  "/invitations/:id",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    await db
      .delete(invitationsTable)
      .where(eq(invitationsTable.id, Number(id)));

    res.json({ success: true });
  },
);

export default router;
