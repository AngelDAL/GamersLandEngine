import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, buildVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { email: rawEmail, currentPassword } = await req.json();
    const email = rawEmail?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Correo requerido" }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // If user already has a password, verify it
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Debes ingresar tu contraseña actual para cambiar el correo" },
          { status: 403 }
        );
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
      }
    }

    // Already taken?
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Ese correo ya está registrado" }, { status: 409 });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(24).toString("hex");

    // Update user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email,
        emailVerified: null,
        verificationToken,
        passwordHash: user.passwordHash || undefined,
      },
    });

    // Send verification email
    const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
    const { subject, html } = buildVerificationEmail(baseUrl, verificationToken);
    await sendEmail({ to: email, subject, html }).catch((err) =>
      console.error("[EMAIL] Failed to send verification:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Correo actualizado. Revisa tu bandeja para verificarlo.",
    });
  } catch (err) {
    console.error("Error updating email:", err);
    return NextResponse.json({ error: "Error al actualizar correo" }, { status: 500 });
  }
}
