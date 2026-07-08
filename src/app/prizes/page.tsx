import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Determine user's final position in a tournament based on match results
async function getUserPosition(tournamentId: string, userId: string): Promise<number | null> {
  // Get all rounds for this tournament ordered by round number desc
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
    select: {
      id: true,
      roundNumber: true,
    },
  });
  if (rounds.length === 0) return null;

  const maxRound = rounds[0].roundNumber;

  // Get the user's match results in this tournament
  const results = await prisma.matchResult.findMany({
    where: {
      userId,
      match: { round: { tournamentId } },
    },
    include: {
      match: { select: { roundId: true, bracketPosition: true } },
    },
    orderBy: { match: { round: { roundNumber: "desc" } } },
    take: 5,
  });

  if (results.length === 0) return null;

  // Find the highest round the user played in
  const userRounds = await prisma.matchResult.findMany({
    where: { userId, match: { round: { tournamentId } } },
    select: { result: true, match: { select: { round: { select: { roundNumber: true } } } } },
    orderBy: { match: { round: { roundNumber: "desc" } } },
  });

  if (userRounds.length === 0) return null;

  // Final round result determines 1st or 2nd place
  const finalMatchResult = userRounds[0];
  const finalRound = finalMatchResult.match.round.roundNumber;

  if (finalRound === maxRound) {
    // User played in the final round
    if (finalMatchResult.result === "WON") return 1; // Champion
    return 2; // Runner-up
  }

  // For position 3, check if tournament has at least 4 participants
  // (so there's a semifinal round)
  const regCount = await prisma.tournamentRegistration.count({
    where: { tournamentId, status: "CONFIRMED" },
  });

  if (regCount >= 4 && finalRound === maxRound - 1) {
    // User lost in the round before the final (semifinal for 4-person bracket)
    return 3;
  }

  // For larger brackets, positions 4+ could be determined similarly
  // but for now just return a "participation" status
  return null;
}

export default async function PrizesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const userId = session.user.id;

  const [claimedPrizes, availablePrizes] = await Promise.all([
    prisma.prizeClaim.findMany({
      where: { userId },
      include: {
        prize: {
          include: {
            tournament: { select: { id: true, name: true, game: true } },
            sponsor: { select: { username: true } },
          },
        },
        clerk: { select: { username: true } },
      },
      orderBy: { claimedAt: "desc" },
    }),
    prisma.prize.findMany({
      where: {
        tournament: {
          registrations: { some: { userId } },
          status: "COMPLETED",
        },
        claims: { none: { userId } },
      },
      include: {
        tournament: { select: { id: true, name: true, game: true, isTeamBased: true } },
        sponsor: { select: { username: true } },
      },
    }),
  ]);

  // Filter by actual position
  const filteredPrizes: typeof availablePrizes = [];
  for (const p of availablePrizes) {
    const pos = await getUserPosition(p.tournament.id, userId);
    // Show prize only if:
    // - prize has no position requirement (participation prize) → show to all
    // - user's position matches the prize's position
    // - user's position EXACTLY matches the prize's position
    if (!p.position || (pos !== null && pos === p.position)) {
      filteredPrizes.push(p);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Premios</h1>
      <p className="text-muted text-sm mb-8">Premios disponibles y reclamados</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Disponibles ({filteredPrizes.length})</h2>
          {filteredPrizes.length === 0 ? (
            <p className="text-muted text-sm">No tienes premios disponibles</p>
          ) : (
            <div className="space-y-2">
              {filteredPrizes.map((p) => (
                <div key={p.id} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.tournament.name} — {p.value}</p>
                  {p.position && <Badge variant="gold" className="mt-1">#{p.position}</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Reclamados ({claimedPrizes.length})</h2>
          {claimedPrizes.length === 0 ? (
            <p className="text-muted text-sm">Sin premios reclamados aún</p>
          ) : (
            <div className="space-y-2">
              {claimedPrizes.map((c) => (
                <div key={c.id} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{c.prize.name}</p>
                  <p className="text-xs text-muted">{c.prize.tournament.name} — {c.prize.value}</p>
                  <p className="text-[10px] text-muted">Entregado por: {c.clerk.username}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
