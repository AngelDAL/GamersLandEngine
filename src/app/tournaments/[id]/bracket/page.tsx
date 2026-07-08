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

  // For individual tournaments, get registered players
  let individualPlayers: { id: string; name: string }[] = [];
  let playerNames: Record<string, string> = {};
  if (!tournament.isTeamBased) {
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: id },
      include: { user: { select: { id: true, username: true } } },
    });
    individualPlayers = registrations.map((r) => ({ id: r.user.id, name: r.user.username }));
    for (const r of registrations) {
      playerNames[r.user.id] = r.user.username;
    }

    // Also resolve any player IDs referenced in matches (for already generated brackets)
    const playerIds = new Set<string>();
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.team1Id) playerIds.add(match.team1Id);
        if (match.team2Id) playerIds.add(match.team2Id);
      }
    }
    if (playerIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(playerIds) } },
        select: { id: true, username: true },
      });
      for (const u of users) {
        if (!playerNames[u.id]) playerNames[u.id] = u.username;
      }
    }
  }

  const registeredTeams = tournament.tournamentTeams.map((tt) => ({
    id: tt.team.id,
    name: tt.team.name,
    captainId: tt.team.captainId,
  }));

  // Serialize tournament to plain object (fix Decimal error)
  const serializedTournament = {
    ...tournament,
    entryFee: tournament.entryFee ? Number(tournament.entryFee) : null,
    eventDate: tournament.eventDate.toISOString(),
    createdAt: tournament.createdAt.toISOString(),
    registrationDeadline: tournament.registrationDeadline?.toISOString() || null,
  };

  return (
    <BracketInteractive
      tournament={serializedTournament}
      canEdit={!!canEdit}
      userId={session?.user?.id}
      userTeamIds={userTeamIds}
      tournamentName={tournament.name}
      tournamentId={tournament.id}
      registeredTeams={registeredTeams}
      isIndividual={!tournament.isTeamBased}
      playerNames={playerNames}
      individualPlayers={individualPlayers}
      maxSlots={tournament.maxTeams}
    />
  );
}
