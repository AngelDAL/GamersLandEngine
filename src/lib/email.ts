/**
 * Email sending utility using Resend.
 * Configure via env vars:
 *   RESEND_API_KEY=re_xxx
 *   EMAIL_FROM=GamersLand <noreply@gamersland.tabtap.dev>
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[EMAIL] Resend API key not configured — skipping email send to", to);
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.EMAIL_FROM || "GamersLand <noreply@gamersland.tabtap.dev>";

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  return { sent: true };
}

export function buildVerificationEmail(baseUrl: string, token: string) {
  const url = `${baseUrl}/auth/verify-email?token=${token}`;
  return {
    subject: "Verifica tu correo — GamersLand Irapuato",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0E1A;color:#E8E0D0;border-radius:12px;border:1px solid rgba(200,170,110,0.3)">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:40px;margin-bottom:8px">🎮</div>
          <h1 style="color:#C8AA6E;margin:0;font-size:22px">GAMERSLAND</h1>
          <p style="color:#8B7E66;font-size:13px">Irapuato — Torneos de League of Legends</p>
        </div>
        <p style="margin:0 0 16px;font-size:15px">¡Gracias por registrarte!</p>
        <p style="margin:0 0 24px;font-size:14px;color:#A89F91">
          Para activar tu cuenta, haz clic en el botón de abajo:
        </p>
        <div style="text-align:center;margin-bottom:24px">
          <a href="${url}" style="display:inline-block;padding:14px 32px;background:#C8AA6E;color:#0A0E1A;text-decoration:none;border-radius:10px;font-weight:bold;font-size:15px">
            Verificar correo
          </a>
        </div>
        <p style="font-size:12px;color:#6B6254;text-align:center">
          Si no creaste esta cuenta, ignora este mensaje.
        </p>
        <p style="font-size:12px;color:#6B6254;text-align:center">
          O copia este enlace en tu navegador:<br/>
          <span style="font-size:11px;word-break:break-all">${url}</span>
        </p>
      </div>
    `,
  };
}

export function buildResetEmail(baseUrl: string, token: string) {
  const url = `${baseUrl}/auth/reset-password?token=${token}`;
  return {
    subject: "Recupera tu contraseña — GamersLand Irapuato",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0E1A;color:#E8E0D0;border-radius:12px;border:1px solid rgba(200,170,110,0.3)">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:40px;margin-bottom:8px">🔐</div>
          <h1 style="color:#C8AA6E;margin:0;font-size:22px">GAMERSLAND</h1>
          <p style="color:#8B7E66;font-size:13px">Recuperación de contraseña</p>
        </div>
        <p style="margin:0 0 16px;font-size:15px">Recibimos una solicitud para restablecer tu contraseña.</p>
        <p style="margin:0 0 24px;font-size:14px;color:#A89F91">
          Haz clic en el botón para crear una nueva contraseña:
        </p>
        <div style="text-align:center;margin-bottom:24px">
          <a href="${url}" style="display:inline-block;padding:14px 32px;background:#C8AA6E;color:#0A0E1A;text-decoration:none;border-radius:10px;font-weight:bold;font-size:15px">
            Restablecer contraseña
          </a>
        </div>
        <p style="font-size:12px;color:#6B6254;text-align:center">
          Este enlace expira en 1 hora. Si no solicitaste esto, ignora el mensaje.
        </p>
        <p style="font-size:12px;color:#6B6254;text-align:center">
          <span style="font-size:11px;word-break:break-all">${url}</span>
        </p>
      </div>
    `,
  };
}

export { resend };
