import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido o expirado" },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VERIFY] Error:", error);
    return NextResponse.json(
      { error: "Error al verificar el correo" },
      { status: 500 }
    );
  }
}
