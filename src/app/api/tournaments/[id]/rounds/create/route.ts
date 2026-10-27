import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament, emitBracketUpdated } from "@/lib/tournament-server";

const createSchema = z.object({ matchCount: z.number().int().min(1, "Se requiere al menos 1 combate").max(64) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede crear rondas" }, { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { id: true } });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { matchCount } = parsed.data;

  const round = await prisma.$transaction(async (tx) => {
    const lastRound = await tx.tournamentRound.findFirst({
      where: { tournamentId: id },
      orderBy: { roundNumber: "desc" },
    });
    const roundNumber = (lastRound?.roundNumber || 0) + 1;
    const created = await tx.tournamentRound.create({
      data: { tournamentId: id, roundNumber },
    });
    for (let i = 0; i < matchCount; i++) {
      await tx.match.create({
        data: { roundId: created.id, bracketPosition: i, status: "PENDING" },
      });
    }
    return created;
  });

  emitBracketUpdated(id);

  return NextResponse.json({ round, matchCount }, { status: 201 });
}
