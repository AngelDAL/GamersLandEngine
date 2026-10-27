import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * POST /api/users/[userId]/reset-password
 * Solo ADMIN. Contraseña provisional para una cuenta (la fuerza de la nueva
 * contraseña es responsabilidad del administrador, no del jugador).
 */
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAuth();
    if (!requireRole(session, ["ADMIN"])) {
      return roleForbidden();
    }

    const { userId } = await params;
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, resetToken: null, resetTokenExpires: null },
    });

    return NextResponse.json({ ok: true, success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    console.error("[USER RESET-PASSWORD] Error:", err);
    return NextResponse.json(
      { error: "Error al restablecer la contraseña" },
      { status: 500 }
    );
  }
}
