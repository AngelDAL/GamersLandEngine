import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/player/AvatarUpload";
import { NotificationListener } from "@/components/player/NotificationListener";
import { PlayerDashboardClient } from "./PlayerDashboardClient";

export default async function PlayerDashboard() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, avatarUrl: true },
  });

  const [registrations, memberships, matchResults, claimedCount] = await Promise.all([
    prisma.tournamentRegistration.findMany({
      where: { userId: session.user.id },
      include: {
        tournament: { select: { id: true, name: true, game: true, status: true, eventDate: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teamMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { team: { select: { id: true, name: true, captainId: true } } },
    }),
    prisma.matchResult.findMany({
      where: { userId: session.user.id },
      include: {
        match: {
          include: {
            round: {
              include: { tournament: { select: { id: true, name: true, game: true } } },
            },
            team1: { select: { name: true } },
            team2: { select: { name: true } },
          },
        },
      },
      orderBy: { match: { round: { roundNumber: "desc" } } },
      take: 15,
    }),
    prisma.prizeClaim.count({ where: { userId: session.user.id } }),
  ]);

  const wins = matchResults.filter((r) => r.result === "WON").length;
  const total = matchResults.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {user && <AvatarUpload currentUrl={user.avatarUrl} username={user.username} />}
          <div>
            <h1 className="text-3xl font-bold text-gold mb-1">Panel del Jugador</h1>
            <p className="text-muted text-sm">{session.user.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/tournaments" className="px-4 py-2 bg-gold text-background font-bold rounded text-sm">Ver Torneos</Link>
          <Link href="/prizes" className="px-4 py-2 border border-gold text-gold rounded text-sm">Premios</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card><p className="text-muted text-sm">Partidas</p><p className="text-2xl font-bold">{total}</p></Card>
        <Card><p className="text-muted text-sm">Victorias</p><p className="text-2xl font-bold text-green">{wins}</p></Card>
        <Card><p className="text-muted text-sm">Win Rate</p><p className="text-2xl font-bold text-gold">{winRate}%</p></Card>
        <Card><p className="text-muted text-sm">Premios</p><p className="text-2xl font-bold text-blue-accent">{claimedCount}</p></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="text-lg font-bold text-gold mb-4">Historial de Partidas</h2>
          {matchResults.length === 0 ? (
            <p className="text-muted text-sm">Aún no has jugado ninguna partida</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {matchResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.match.round.tournament.name}</p>
                    <p className="text-xs text-muted">
                      {r.match.team1?.name} vs {r.match.team2?.name}
                    </p>
                  </div>
                  <Badge variant={r.result === "WON" ? "green" : r.result === "LOST" ? "red" : "default"}>
                    {r.result === "WON" ? "Victoria" : r.result === "LOST" ? "Derrota" : r.result}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {matchResults.length > 0 && (
            <Link href={`/players/${session.user.id}`} className="text-blue-accent hover:underline text-xs mt-2 inline-block">
              Ver historial completo →
            </Link>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-bold text-gold mb-4">Mis Equipos</h2>
            {memberships.length === 0 ? (
              <p className="text-muted text-sm">No estás en ningún equipo</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((m) => (
                  <Link key={m.id} href={`/teams/${m.team.id}`} className="block py-2 border-b border-border last:border-0 hover:text-gold transition-colors">
                    <p className="font-medium text-sm">{m.team.name}</p>
                    <p className="text-xs text-muted">{m.team.captainId === session.user.id ? "Capitán" : "Miembro"}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/teams/create" className="text-blue-accent hover:underline text-xs mt-2 inline-block">
              Crear equipo +
            </Link>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-gold mb-4">Mis Registros</h2>
            {registrations.length === 0 ? (
              <p className="text-muted text-sm">No estás registrado en torneos</p>
            ) : (
              <div className="space-y-2">
                {registrations.slice(0, 5).map((r) => (
                  <Link key={r.id} href={`/tournaments/${r.tournament.id}`} className="block py-2 border-b border-border last:border-0 hover:text-gold transition-colors">
                    <p className="text-sm font-medium">{r.tournament.name}</p>
                    <p className="text-xs text-muted">{r.tournament.game.replace(/_/g, " ")}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <PlayerDashboardClient userId={session.user.id} username={session.user.name} />
      <NotificationListener userId={session.user.id} />
    </div>
  );
}
