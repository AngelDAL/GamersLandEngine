import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoLProfileSection } from "@/components/player/LoLProfileSection";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      registrations: {
        include: {
          tournament: { select: { id: true, name: true, game: true, status: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      matchResults: {
        include: {
          match: {
            include: {
              round: {
                include: { tournament: { select: { id: true, name: true, game: true } } },
              },

            },
          },
        },
        orderBy: { match: { round: { roundNumber: "desc" } } },
        take: 20,
      },
      claimedPrizes: {
        include: {
          prize: { include: { tournament: { select: { name: true } } } },
          clerk: { select: { username: true } },
        },
        orderBy: { claimedAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const isOwner = session?.user?.id === user.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const canSeePrivate = isOwner || isAdmin;

  // Privacy: friends/logged-out visitors only see WON matches; owners and admins see everything.
  const visibleMatchResults = canSeePrivate
    ? user.matchResults
    : user.matchResults.filter((r) => r.result === "WON");

  const wins = visibleMatchResults.filter((r) => r.result === "WON").length;
  const total = visibleMatchResults.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {!canSeePrivate && (
        <div className="text-xs text-muted/70 border-b border-border/30 py-2 mb-4 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          <span>Estás viendo el perfil público de {user.username}.</span>
        </div>
      )}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center text-gold text-2xl font-bold">
          {user.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gold">{user.username}</h1>
          <Badge variant={user.role === "PLAYER" ? "green" : "gold"}>{user.role}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card><p className="text-muted text-sm">Partidas</p><p className="text-2xl font-bold">{total}</p></Card>
        <Card><p className="text-muted text-sm">Victorias</p><p className="text-2xl font-bold text-green">{wins}</p></Card>
        <Card><p className="text-muted text-sm">Win Rate</p><p className="text-2xl font-bold text-gold">{winRate}%</p></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Historial de Partidas</h2>
          {visibleMatchResults.length === 0 ? (
            <p className="text-muted text-sm">Sin partidas registradas</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {visibleMatchResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.match.round.tournament.name}</p>
                    <p className="text-xs text-muted">Partida #{r.match.bracketPosition !== null ? r.match.bracketPosition + 1 : "?"}</p>
                  </div>
                  <Badge variant={r.result === "WON" ? "green" : r.result === "LOST" ? "red" : "default"}>
                    {r.result}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {canSeePrivate && (
          <Card>
            <h2 className="text-lg font-bold text-gold mb-4">Premios Reclamados</h2>
            {user.claimedPrizes.length === 0 ? (
              <p className="text-muted text-sm">Sin premios reclamados</p>
            ) : (
              <div className="space-y-2">
                {user.claimedPrizes.map((c) => (
                  <div key={c.id} className="py-2 border-b border-border last:border-0">
                    <p className="text-sm font-medium">{c.prize.name}</p>
                    <p className="text-xs text-muted">
                      {c.prize.tournament.name} — {c.prize.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* LoL Profile — public, server-rendered, DB-backed. Zero Riot calls on page load. */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gold mb-4">Perfil de League of Legends</h2>
        <LoLProfileSection userId={user.id} username={user.username} />
      </div>
    </div>
  );
}
