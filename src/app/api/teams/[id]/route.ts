import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      captain: { select: { id: true, username: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { status: "asc" },
      },
      teamResults: {
        include: { match: { select: { id: true, roundId: true, status: true } } },
        orderBy: { match: { round: { roundNumber: "desc" } } },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(team);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();
  const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
  if (!team || (team.captainId !== session.user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const updated = await prisma.team.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
