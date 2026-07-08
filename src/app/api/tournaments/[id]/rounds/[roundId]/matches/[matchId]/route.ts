import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function notifyParticipants(matchId: string, tournamentId: string, type: string, title: string, message: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: { select: { tournament: { select: { name: true, isTeamBased: true } } } },
    },
  });
  if (!match) return;

  const participantIds = new Set<string>();
  const redirectUrl = `/tournaments/${tournamentId}/bracket`;

  if (match.round.tournament.isTeamBased) {
    for (const tid of [match.team1Id, match.team2Id]) {
      if (!tid) continue;
      const members = await prisma.teamMember.findMany({
        where: { teamId: tid, status: "ACTIVE" },
        select: { userId: true },
      });
      members.forEach((m) => participantIds.add(m.userId));
    }
  } else {
    if (match.team1Id) participantIds.add(match.team1Id);
    if (match.team2Id) participantIds.add(match.team2Id);
  }

  for (const userId of participantIds) {
    await prisma.notification.create({
      data: { userId, type, title, message, matchId, redirectUrl },
    });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { matchId, id: tournamentId } = await params;
  const data = await req.json();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: { select: { tournamentId: true, roundNumber: true, tournament: { select: { name: true, location: true, isTeamBased: true } } } },
    },
  });

  if (!match || match.round.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  // Handle scheduling separately
  if (data.scheduledAt !== undefined) {
    const scheduledDate = data.scheduledAt ? new Date(data.scheduledAt) : null;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { scheduledAt: scheduledDate },
    });

    if (scheduledDate) {
      const tournament = match.round.tournament;
      await notifyParticipants(
        matchId, tournamentId, "match_scheduled",
        `Partida programada - ${tournament.name}`,
        `Ronda ${match.round.roundNumber} programada para el ${scheduledDate.toLocaleDateString("es-MX")} a las ${scheduledDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}${tournament.location ? ` en ${tournament.location}` : ""}`
      );
    }

    return NextResponse.json(updated);
  }

  // Normal update (scores, winner, status)
  const isTeamBased = match.round.tournament.isTeamBased;
  // winnerId only valid for team tournaments (FK → Team), skip for individual
  const winnerIdToSet = isTeamBased ? (data.winnerId ?? match.winnerId) : undefined;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      score1: "score1" in data ? data.score1 : match.score1,
      score2: "score2" in data ? data.score2 : match.score2,
      ...(winnerIdToSet !== undefined ? { winnerId: winnerIdToSet } : {}),
      status: data.status ?? match.status,
      notes: data.notes ?? match.notes,
      startedAt: data.status === "IN_PROGRESS" && !match.startedAt ? new Date() : match.startedAt,
      endedAt: data.status === "COMPLETED" ? new Date() : match.endedAt,
    },
    include: { winner: { select: { id: true, name: true } } },
  });

  // Derive winner ID (works for both team and individual tournaments)
  // For team tournaments: winnerId is a team ID from the client
  // For individual tournaments: winnerId is a user ID from the client (manage page "Ganador" button)
  // Fallback: derive from scores
  const resolvedWinnerId = data.winnerId
    ?? ((data.score1 ?? match.score1 ?? 0) > (data.score2 ?? match.score2 ?? 0)
      ? match.team1Id
      : (data.score2 ?? match.score2 ?? 0) > (data.score1 ?? match.score1 ?? 0)
        ? match.team2Id
        : null);

  // Create match results for players
  if (data.status === "COMPLETED" && resolvedWinnerId) {
    if (isTeamBased) {
      for (const tid of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
        await prisma.teamMatchResult.create({
          data: { matchId, teamId: tid, result: tid === resolvedWinnerId ? "WON" : "LOST" },
        });
        const members = await prisma.teamMember.findMany({
          where: { teamId: tid, status: "ACTIVE" },
          select: { userId: true },
        });
        for (const m of members) {
          await prisma.matchResult.create({
            data: { matchId, userId: m.userId, teamId: tid, result: tid === resolvedWinnerId ? "WON" : "LOST" },
          });
        }
      }
    } else {
      for (const userId of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
        await prisma.matchResult.create({
          data: { matchId, userId, result: userId === resolvedWinnerId ? "WON" : "LOST" },
        });
      }
    }
  }

  // Notify on completion
  if (data.status === "COMPLETED" && resolvedWinnerId) {
    const winnerName = isTeamBased
      ? (updated.winner?.name || "Equipo")
      : await prisma.user.findUnique({ where: { id: resolvedWinnerId }, select: { username: true } }).then(u => u?.username || "Jugador");
    await notifyParticipants(
      matchId, tournamentId, "match_result",
      `Resultado - ${match.round.tournament.name}`,
      `Ronda ${match.round.roundNumber}: Ganador ${winnerName}`
    );
  }

  // Propagate winner to next round
  if (data.status === "COMPLETED" && resolvedWinnerId) {
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
          data: isLeftChild ? { team1Id: resolvedWinnerId } : { team2Id: resolvedWinnerId },
        });
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { matchId } = await params;
  await prisma.match.delete({ where: { id: matchId } });
  return NextResponse.json({ success: true });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      winner: { select: { id: true, name: true } },
      results: { include: { user: { select: { id: true, username: true } } } },
    },
  });
  if (!match) return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  return NextResponse.json(match);
}
