import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { matchId, id: tournamentId } = await params;
  const data = await req.json();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: { select: { tournamentId: true, roundNumber: true } } },
  });

  if (!match || match.round.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      score1: data.score1 ?? match.score1,
      score2: data.score2 ?? match.score2,
      winnerId: data.winnerId ?? match.winnerId,
      status: data.status ?? match.status,
      notes: data.notes ?? match.notes,
      startedAt: data.status === "IN_PROGRESS" && !match.startedAt ? new Date() : match.startedAt,
      endedAt: data.status === "COMPLETED" ? new Date() : match.endedAt,
    },
    include: {
      team1: { select: { id: true, name: true } },
      team2: { select: { id: true, name: true } },
      winner: { select: { id: true, name: true } },
    },
  });

  // If match is completed, propagate winner to next round
  if (data.status === "COMPLETED" && data.winnerId) {
    const nextRound = await prisma.tournamentRound.findFirst({
      where: { tournamentId, roundNumber: match.round.roundNumber + 1 },
      include: { matches: { orderBy: { bracketPosition: "asc" } } },
    });

    if (nextRound) {
      const pos = match.bracketPosition ?? 0;
      const nextMatchIndex = Math.floor(pos / 2);
      const nextMatch = nextRound.matches[nextMatchIndex];

      if (nextMatch) {
        const isLeftChild = pos % 2 === 0;
        await prisma.match.update({
          where: { id: nextMatch.id },
          data: isLeftChild
            ? { team1Id: data.winnerId }
            : { team2Id: data.winnerId },
        });
      }
    }
  }

  return NextResponse.json(updated);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: { select: { id: true, name: true, logoUrl: true } },
      team2: { select: { id: true, name: true, logoUrl: true } },
      winner: { select: { id: true, name: true } },
      results: { include: { user: { select: { id: true, username: true } } } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  return NextResponse.json(match);
}
