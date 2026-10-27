import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { error: "Correo electrónico requerido" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // No se revela si el correo existe — siempre se responde éxito.
      return NextResponse.json({
        success: true,
        ok: true,
        emailSent: false,
        message:
          "Si el correo está registrado, recibirás un enlace de recuperación.",
      });
    }

    // El token se genera en BD aunque no haya correo configurado: en cuanto se
    // agregue RESEND_API_KEY el flujo completo funcionará sin tocar código.
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    // Sin clave de Resend la recuperación degrada con 200 y emailSent: false
    // — nunca un 500 que confunda al usuario. El import es dinámico porque
    // `src/lib/email.ts` instancia `new Resend(...)` al cargarse y lanza
    // cuando falta la variable.
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const { sendEmail, buildResetEmail } = await import("@/lib/email");
        const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
        const { subject, html } = buildResetEmail(baseUrl, resetToken);
        const result = await sendEmail({ to: email, subject, html });
        emailSent = result.sent;
      } catch (err) {
        console.error("[FORGOT] Error al enviar correo:", err);
        emailSent = false;
      }
    }

    return NextResponse.json({
      success: true,
      ok: true,
      emailSent,
      message: emailSent
        ? "Si el correo está registrado, recibirás un enlace de recuperación."
        : "Recuperación por correo no disponible. Contacta al administrador.",
    });
  } catch (error) {
    console.error("[FORGOT] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
