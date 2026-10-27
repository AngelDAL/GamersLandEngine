import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStandings, type StandingRow } from "@/lib/bracket-engine";

/**
 * Tabla de posiciones del torneo (round-robin): PJ/G/E/P, GF/GC y Pts
 * (3/1/0). Público: es información de solo lectura de la llave.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      bracketType: true,
      isTeamBased: true,
      tournamentTeams: { select: { team: { select: { id: true, name: true } } } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        select: { matches: { select: { team1Id: true, team2Id: true, score1: true, score2: true, status: true } } },
      },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  let participants: { id: string; name: string }[];
  if (tournament.isTeamBased) {
    participants = tournament.tournamentTeams.map((tt) => ({ id: tt.team.id, name: tt.team.name }));
  } else {
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: id },
      select: { user: { select: { id: true, username: true } } },
    });
    participants = registrations.map((r) => ({ id: r.user.id, name: r.user.username }));
  }

  const matches = tournament.rounds.flatMap((r) => r.matches);
  const standings: StandingRow[] = computeStandings(participants, matches);

  return NextResponse.json({
    bracketType: tournament.bracketType,
    isTeamBased: tournament.isTeamBased,
    standings,
  });
}
