import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament } from "@/lib/tournament-server";

const addTeamSchema = z.object({ teamId: z.string().min(1, "Falta el equipo") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede añadir equipos" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = addTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { teamId } = parsed.data;

  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { id: true } });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    return NextResponse.json({ error: "El equipo no existe" }, { status: 404 });
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
