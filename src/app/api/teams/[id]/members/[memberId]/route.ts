import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { memberId } = await params;
  const { status, lane } = await req.json();

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: { team: { select: { captainId: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const isCaptain = member.team.captainId === session.user.id;
  const isSelf = member.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  if (!isCaptain && !isSelf && !isAdmin) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const data: any = {};
  if (status !== undefined) data.status = status;
  if (lane !== undefined) data.lane = lane;

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { memberId } = await params;
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: { team: { select: { captainId: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const isCaptain = member.team.captainId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isCaptain && !isAdmin) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
