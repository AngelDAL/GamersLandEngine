import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { newCaptainId } = await req.json();

  const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const isCurrentCaptain = team.captainId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isCurrentCaptain && !isAdmin) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  // Verify new captain is a member
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
}
