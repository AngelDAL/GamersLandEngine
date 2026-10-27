import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament, emitBracketUpdated } from "@/lib/tournament-server";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: tournamentId, roundId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede borrar rondas" }, { status: 403 });
  }

  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId },
    select: { id: true },
  });
  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const matches = await tx.match.findMany({ where: { roundId }, select: { id: true } });
    const matchIds = matches.map((m) => m.id);
    if (matchIds.length > 0) {
      await tx.chatRoom.deleteMany({ where: { matchId: { in: matchIds } } });
    }
    await tx.match.deleteMany({ where: { roundId } });
    await tx.tournamentRound.delete({ where: { id: roundId } });
  });

  emitBracketUpdated(tournamentId);

  return NextResponse.json({ success: true });
}
