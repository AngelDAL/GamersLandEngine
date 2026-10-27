import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const changeEmailSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  currentPassword: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = changeEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    const email = parsed.data.email.toLowerCase();
    const { currentPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Cambiar el correo exige la contraseña actual siempre: es una operación
    // sensible y no hay cuentas legítimas sin contraseña.
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Cuenta sin contraseña. Contacta al administrador." },
        { status: 403 }
      );
    }
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

    // Send verification email. Sin clave de Resend la verificación se degrada
    // con un mensaje claro en lugar de un 500. El import es dinámico porque
    // `src/lib/email.ts` instancia `new Resend(...)` al cargarse y lanza
    // cuando falta la variable.
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const { sendEmail, buildVerificationEmail } = await import("@/lib/email");
        const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
        const { subject, html } = buildVerificationEmail(baseUrl, verificationToken);
        emailSent = (await sendEmail({ to: email, subject, html })).sent;
      } catch (err) {
        console.error("[EMAIL] Error al enviar verificación:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Correo actualizado. Revisa tu bandeja para verificarlo."
        : "Correo actualizado. Verificación por correo no disponible; contacta al administrador.",
    });
  } catch (err) {
    console.error("Error updating email:", err);
    return NextResponse.json({ error: "Error al actualizar correo" }, { status: 500 });
  }
}
