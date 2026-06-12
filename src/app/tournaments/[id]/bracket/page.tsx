import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BracketInteractive } from "./BracketInteractive";

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      rounds: {
        include: {
          matches: {
            include: {
              team1: { select: { id: true, name: true, logoUrl: true } },
              team2: { select: { id: true, name: true, logoUrl: true } },
              winner: { select: { id: true, name: true } },
            },
            orderBy: { bracketPosition: "asc" },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      tournamentTeams: {
        include: {
          team: {
            select: { id: true, name: true, captainId: true },
          },
        },
      },
    },
  });

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gold mb-4">Bracket no disponible</h1>
        <p className="text-muted">El torneo no existe</p>
      </div>
    );
  }

  const canEdit = session?.user && (session.user.role === "ADMIN" || session.user.role === "ORGANIZER");

  let userTeamIds: string[] = [];
  if (session?.user?.id) {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { teamId: true },
    });
    userTeamIds = memberships.map((m) => m.teamId);
  }

  // For individual tournaments, resolve player names
  let playerNames: Record<string, string> = {};
  if (!tournament.isTeamBased) {
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: id, status: "CONFIRMED" },
      include: { user: { select: { id: true, username: true } } },
    });
    for (const r of registrations) {
      playerNames[r.user.id] = r.user.username;
    }
    // Also check all player IDs referenced in matches
    const playerIds = new Set<string>();
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.team1Id) playerIds.add(match.team1Id);
        if (match.team2Id) playerIds.add(match.team2Id);
      }
    }
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(playerIds) } },
      select: { id: true, username: true },
    });
    for (const u of users) {
      if (!playerNames[u.id]) playerNames[u.id] = u.username;
    }
  }

  const registeredTeams = tournament.tournamentTeams.map((tt) => ({
    id: tt.team.id,
    name: tt.team.name,
    captainId: tt.team.captainId,
  }));

  return (
    <BracketInteractive
      tournament={tournament}
      canEdit={!!canEdit}
      userId={session?.user?.id}
      userTeamIds={userTeamIds}
      tournamentName={tournament.name}
      tournamentId={tournament.id}
      registeredTeams={registeredTeams}
      isIndividual={!tournament.isTeamBased}
      playerNames={playerNames}
    />
  );
}
