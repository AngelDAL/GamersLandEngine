import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// El correo es opcional: si no llega a verificar, la cuenta queda activa igual
// y el administrador puede verificarla desde el panel.
const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(20, "El usuario puede tener máximo 20 caracteres")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "El usuario solo puede contener letras, números, punto, guion bajo o guion"
    ),
  email: z
    .string()
    .trim()
    .email("Correo electrónico inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const { username, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está ocupado" },
        { status: 409 }
      );
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "Ese correo ya está registrado" },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = email ? crypto.randomBytes(32).toString("hex") : null;

    await prisma.user.create({
      data: {
        username,
        email: email ?? null,
        passwordHash,
        verificationToken,
      },
    });

    // El correo se intenta enviar sin bloquear la respuesta: si no hay clave de
    // Resend configurada, el registro PROCEDE igual (emailSent: false).
    // El import es dinámico y perezoso a propósito: `src/lib/email.ts` instancia
    // `new Resend(...)` al cargarse y eso lanza sin RESEND_API_KEY, lo que
    // reventaba esta ruta con 500 en vez de degradar.
    let emailSent = false;
    if (email && verificationToken && process.env.RESEND_API_KEY) {
      try {
        const { sendEmail, buildVerificationEmail } = await import("@/lib/email");
        const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
        const { subject, html } = buildVerificationEmail(baseUrl, verificationToken);
        const result = await sendEmail({ to: email, subject, html });
        emailSent = result.sent;
      } catch (err) {
        console.error("[REGISTER] No se pudo enviar la verificación:", err);
        emailSent = false;
      }
    }

    return NextResponse.json({
      success: true,
      ok: true,
      emailSent,
      message: emailSent
        ? "Cuenta creada. Revisa tu correo para verificar tu cuenta."
        : email
          ? "Cuenta creada. Revisa tu correo cuando esté activo; si no llega, contacta al administrador."
          : "Cuenta creada. Ya puedes iniciar sesión.",
    });
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
