import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getIO } from "@/socket/server";

export async function POST(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { matchId } = await params;
  const body = await req.json();
  const { participantId } = body;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: {
        select: {
          id: true,
          tournamentId: true,
          roundNumber: true,
          tournament: { select: { isTeamBased: true } },
        },
      },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  const newWinnerId = match.winnerId === participantId ? null : participantId;
  const isTeamBased = match.round.tournament.isTeamBased;

  // winnerId only valid for team tournaments (FK → Team), skip for individual
  const updateData: any = { status: newWinnerId ? "COMPLETED" : "PENDING" };
  if (isTeamBased) {
    updateData.winnerId = newWinnerId;
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
  });

  // Create MatchResult records if winner was set
  if (newWinnerId) {
    const isTeamBased = match.round.tournament.isTeamBased;

    if (isTeamBased) {
      for (const tid of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
        await prisma.teamMatchResult.create({
          data: { matchId, teamId: tid, result: tid === newWinnerId ? "WON" : "LOST" },
        });
        const members = await prisma.teamMember.findMany({
          where: { teamId: tid, status: "ACTIVE" },
          select: { userId: true },
        });
        for (const m of members) {
          await prisma.matchResult.create({
            data: { matchId, userId: m.userId, teamId: tid, result: tid === newWinnerId ? "WON" : "LOST" },
          });
        }
      }
    } else {
      for (const uid of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
        await prisma.matchResult.create({
          data: { matchId, userId: uid, result: uid === newWinnerId ? "WON" : "LOST" },
        });
      }
    }
  } else {
    // Winner removed: delete existing MatchResult records
    await prisma.matchResult.deleteMany({ where: { matchId } });
    await prisma.teamMatchResult.deleteMany({ where: { matchId } });
  }

  // ── AUTO-ADVANCE: propagate winner to next round ──
  if (newWinnerId && match.bracketPosition !== null) {
    const tournamentId = match.round.tournamentId;
    const currentRound = match.round.roundNumber;
    const currentPos = match.bracketPosition;

    // Find the next round
    const nextRound = await prisma.tournamentRound.findFirst({
      where: { tournamentId, roundNumber: currentRound + 1 },
      include: {
        matches: {
          where: { bracketPosition: Math.floor(currentPos / 2) },
          take: 1,
        },
      },
    });

    if (nextRound && nextRound.matches.length > 0) {
      const nextMatch = nextRound.matches[0];
      // Even position → team1, odd position → team2
      const slot = currentPos % 2 === 0 ? "team1Id" : "team2Id";

      await prisma.match.update({
        where: { id: nextMatch.id },
        data: { [slot]: newWinnerId },
      });

      // Emit bracket update via socket
      try {
        const io = getIO();
        io.emit("bracket:updated", { tournamentId });
      } catch {}
    }
  }

  return NextResponse.json(updated);
}
