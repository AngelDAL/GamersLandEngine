import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament, emitBracketUpdated } from "@/lib/tournament-server";

const createSchema = z.object({ bracketPosition: z.number().int().min(0).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: tournamentId, roundId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede crear combates" }, { status: 403 });
  }

  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId },
    select: { id: true },
  });
  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Posición de llave no válida" }, { status: 400 });
  }

  const match = await prisma.match.create({
    data: {
      roundId,
      bracketPosition: parsed.data.bracketPosition ?? 0,
      status: "PENDING",
    },
  });

  emitBracketUpdated(tournamentId);

  return NextResponse.json(match, { status: 201 });
}
