import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, roleForbidden } from "@/lib/permissions";

const captainSchema = z.object({
  newCaptainId: z.string().uuid("Usuario inválido"),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await req.json();
    const parsed = captainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    const { newCaptainId } = parsed.data;

    const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    const isCurrentCaptain = team.captainId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    if (!isCurrentCaptain && !isAdmin) {
      return roleForbidden();
    }

    // El nuevo capitán debe ser miembro activo del equipo.
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: newCaptainId, teamId: id } },
    });
    if (!member || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "El usuario no es miembro activo del equipo" }, { status: 400 });
    }

    await prisma.team.update({
      where: { id },
      data: { captainId: newCaptainId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAM CAPTAIN] Error:", err);
    return NextResponse.json({ error: "Error al cambiar la capitanía" }, { status: 500 });
  }
}
