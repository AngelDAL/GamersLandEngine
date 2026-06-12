import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { teamId } = await req.json();

  if (!teamId) {
    return NextResponse.json({ error: "Se requiere teamId" }, { status: 400 });
  }

  const existing = await prisma.tournamentTeam.findUnique({
    where: { tournamentId_teamId: { tournamentId: id, teamId } },
  });
  if (existing) {
    return NextResponse.json({ error: "El equipo ya está registrado en este torneo" }, { status: 409 });
  }

  const tt = await prisma.tournamentTeam.create({
    data: { tournamentId: id, teamId },
  });

  return NextResponse.json(tt, { status: 201 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id },
    include: {
      team: {
        include: {
          captain: { select: { id: true, username: true } },
          members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, username: true } } } },
        },
      },
    },
  });

  return NextResponse.json(teams);
}
