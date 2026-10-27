import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, roleForbidden } from "@/lib/permissions";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    if (team.captainId !== session.user.id && session.user.role !== "ADMIN") {
      return roleForbidden();
    }

    // Miembros y equipo se borran juntos: si algo falla no queda el equipo a medias.
    await prisma.$transaction([
      prisma.teamMember.deleteMany({ where: { teamId: id } }),
      prisma.team.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAM DELETE] Error:", err);
    return NextResponse.json({ error: "Error al eliminar el equipo" }, { status: 500 });
  }
}
