import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  if (team.captainId === session.user.id) {
    return NextResponse.json({ error: "El líder no puede salirse. Transfiere la capitanía primero o elimina el equipo." }, { status: 400 });
  }

  await prisma.teamMember.deleteMany({
    where: { userId: session.user.id, teamId: id },
  });

  return NextResponse.json({ success: true });
}
