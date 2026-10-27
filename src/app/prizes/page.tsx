import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Info, ExternalLink } from "lucide-react";

// Determine user's final position in a tournament based on match results
// (los resultados por jugador se crean también para los miembros del equipo
// ganador, así que esto funciona en torneos por equipo e individuales)
async function getUserPosition(tournamentId: string, userId: string): Promise<number | null> {
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  });
  if (rounds.length === 0) return null;

  const maxRound = rounds[0].roundNumber;

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
    if (finalMatchResult.result === "WON") return 1; // Champion
    return 2; // Runner-up
  }

  // Position 3: lost the round before the final in brackets with ≥4 participants
  const regCount = await prisma.tournamentRegistration.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  if (regCount >= 4 && finalRound === maxRound - 1 && finalMatchResult.result === "LOST") {
    return 3;
  }

  return null;
}

export default async function PrizesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const userId = session.user.id;

  // El usuario puede participar inscribiéndose directamente o vía su equipo
  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: { teamId: true },
  });
  const myTeamIds = memberships.map((m) => m.teamId);

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
          status: "COMPLETED",
          OR: [
            { registrations: { some: { userId } } },
            ...(myTeamIds.length > 0
              ? [{ tournamentTeams: { some: { teamId: { in: myTeamIds } } } }]
              : []),
          ],
        },
        claims: { none: { userId } },
      },
      include: {
        tournament: { select: { id: true, name: true, game: true, isTeamBased: true } },
        sponsor: { select: { username: true } },
      },
    }),
  ]);

  // Filter by actual position: premios de participación (sin puesto) ven todos
  // los participantes; los de puesto solo si coincide con tu resultado.
  const filteredPrizes: typeof availablePrizes = [];
  for (const p of availablePrizes) {
    const pos = await getUserPosition(p.tournament.id, userId);
    if (!p.position || (pos !== null && pos === p.position)) {
      filteredPrizes.push(p);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Premios</h1>
      <p className="text-muted text-sm mb-8">Tus premios ganados y los que puedes reclamar</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Tus premios ({claimedPrizes.length})
          </h2>
          {claimedPrizes.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-9 h-9 text-muted mx-auto mb-2 opacity-30" />
              <p className="text-muted text-sm">Aún no te han entregado premios</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {claimedPrizes.map((c) => (
                <div key={c.id} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{c.prize.name}</p>
                  <p className="text-xs text-muted">{c.prize.tournament.name}{c.prize.value ? ` — ${c.prize.value}` : ""}</p>
                  <p className="text-[10px] text-muted">Entregado por: {c.clerk.username}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Disponibles ({filteredPrizes.length})
          </h2>
          {filteredPrizes.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-9 h-9 text-muted mx-auto mb-2 opacity-30" />
              <p className="text-muted text-sm">No tienes premios pendientes por reclamar</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredPrizes.map((p) => (
                <div key={p.id} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.tournament.name}{p.value ? ` — ${p.value}` : ""}</p>
                      {p.sponsor && (
                        <p className="text-[10px] text-muted mt-0.5">Cortesía de {p.sponsor.username}</p>
                      )}
                    </div>
                    {p.position ? (
                      <Badge variant="gold" className="shrink-0">{p.position}.º puesto</Badge>
                    ) : (
                      <Badge variant="green" className="shrink-0">Participación</Badge>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2 p-3 bg-gold/5 border border-gold/20 rounded-xl mt-2">
                <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <p className="text-xs text-muted">
                  Preséntate con el organizador o el patrocinador para reclamar tu premio.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 text-center">
        <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
          Ver torneos <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
