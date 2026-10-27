import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildResetEmail } from "@/lib/email";

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
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({
        success: true,
        message:
          "Si el correo está registrado, recibirás un enlace de recuperación.",
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
    const { subject, html } = buildResetEmail(baseUrl, resetToken);
    sendEmail({ to: email, subject, html }).catch((err) =>
      console.error("[EMAIL] Failed to send reset:", err)
    );

    return NextResponse.json({
      success: true,
      message:
        "Si el correo está registrado, recibirás un enlace de recuperación.",
    });
  } catch (error) {
    console.error("[FORGOT] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
