import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { userId } = await req.json();
  const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
  if (!team || (team.captainId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: id } },
  });
  if (existing) {
    return NextResponse.json({ error: "El usuario ya es miembro o tiene invitación pendiente" }, { status: 409 });
  }

  const member = await prisma.teamMember.create({
    data: { userId, teamId: id, status: "PENDING" },
  });

  return NextResponse.json(member, { status: 201 });
}
