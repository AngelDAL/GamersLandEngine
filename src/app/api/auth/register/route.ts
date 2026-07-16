import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Usuario, correo y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 24) {
      return NextResponse.json(
        { error: "El usuario debe tener entre 3 y 24 caracteres" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "El usuario solo puede contener letras, números y guión bajo" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Correo electrónico inválido" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Check existing username
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está ocupado" },
        { status: 409 }
      );
    }

    // Check existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Ese correo ya está registrado" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        verificationToken,
      },
    });

    // Send verification email (non-blocking — don't fail the response)
    const baseUrl = process.env.AUTH_URL || "https://gamersland.tabtap.dev";
    const { subject, html } = buildVerificationEmail(baseUrl, verificationToken);
    sendEmail({ to: email, subject, html }).catch((err) =>
      console.error("[EMAIL] Failed to send verification:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Cuenta creada. Revisa tu correo para verificar tu cuenta.",
    });
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
