import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament, emitBracketUpdated } from "@/lib/tournament-server";

const assignSchema = z.object({
  matchId: z.string().min(1, "Falta el partido"),
  slot: z.enum(["team1", "team2"], { message: "Slot debe ser 'team1' o 'team2'" }),
  participantId: z.string().min(1, "Falta el participante"),
});

const removeSchema = z.object({
  matchId: z.string().min(1, "Falta el partido"),
  slot: z.enum(["team1", "team2"], { message: "Slot debe ser 'team1' o 'team2'" }),
});

const EDITABLE_STATUSES = ["DRAFT", "OPEN_REGISTRATION"] as const;

async function assertEditable(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, status: true, isTeamBased: true },
  });
  if (!tournament) return { error: "Torneo no encontrado", status: 404 } as const;
  if (!(EDITABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    return {
      error: "La llave manual solo se edita durante la planeación o con las inscripciones abiertas",
      status: 400,
    } as const;
  }
  return { tournament } as const;
}

async function assertBelongsToTournament(tournamentId: string, isTeamBased: boolean, participantId: string) {
  if (isTeamBased) {
    const tt = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId, teamId: participantId } },
      select: { id: true },
    });
    return !!tt;
  }
  const reg = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: participantId } },
    select: { id: true },
  });
  return !!reg;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede asignar slots" }, { status: 403 });
  }

  const editable = await assertEditable(id);
  if ("error" in editable) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { matchId, slot, participantId } = parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: { select: { tournamentId: true } } },
  });
  if (!match || match.round.tournamentId !== id) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (!(await assertBelongsToTournament(id, editable.tournament.isTeamBased, participantId))) {
    return NextResponse.json({ error: "Ese participante no pertenece al torneo" }, { status: 400 });
  }

  // Sin duplicados: nadie puede ocupar dos slots a la vez, ni siquiera los dos
  // del mismo partido (un equipo no puede jugar contra sí mismo).
  const otherSlot = slot === "team1" ? "team2Id" : "team1Id";
  if (match[otherSlot as "team1Id" | "team2Id"] === participantId) {
    return NextResponse.json({ error: "Ese participante ya está asignado en este partido" }, { status: 409 });
  }
  const duplicate = await prisma.match.findFirst({
    where: {
      id: { not: matchId },
      round: { tournamentId: id },
      OR: [{ team1Id: participantId }, { team2Id: participantId }],
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Ese participante ya está asignado en la llave" }, { status: 409 });
  }

  const updateData = slot === "team1" ? { team1Id: participantId } : { team2Id: participantId };
  const updated = await prisma.match.update({ where: { id: matchId }, data: updateData });

  emitBracketUpdated(id);

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede modificar la llave" }, { status: 403 });
  }

  const editable = await assertEditable(id);
  if ("error" in editable) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { matchId, slot } = parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: { select: { tournamentId: true } } },
  });
  if (!match || match.round.tournamentId !== id) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: slot === "team1" ? { team1Id: null } : { team2Id: null },
  });

  emitBracketUpdated(id);

  return NextResponse.json(updated);
}
