import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/player/AvatarUpload";
import { NotificationListener } from "@/components/player/NotificationListener";
import { PlayerDashboardClient } from "./PlayerDashboardClient";
import { Trophy, Swords, Users, Gamepad2, Calendar } from "lucide-react";

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
          },
        },
      },
      orderBy: { match: { round: { roundNumber: "desc" } } },
      take: 20,
    }),
    prisma.prizeClaim.count({ where: { userId: session.user.id } }),
  ]);

  // Resolve participant names for match results
  const participantIds = new Set<string>();
  for (const r of matchResults) {
    if (r.match.team1Id) participantIds.add(r.match.team1Id);
    if (r.match.team2Id) participantIds.add(r.match.team2Id);
  }

  // Batch resolve names (teams and users)
  const [teams, users] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: Array.from(participantIds) } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { id: { in: Array.from(participantIds) } },
      select: { id: true, username: true },
    }),
  ]);
  const nameMap = new Map<string, string>();
  for (const t of teams) nameMap.set(t.id, t.name);
  for (const u of users) nameMap.set(u.id, u.username);

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
          <Link href="/tournaments" className="px-4 py-2 bg-gold text-background font-bold rounded-lg text-sm">Ver Torneos</Link>
          <Link href="/prizes" className="px-4 py-2 border border-gold text-gold rounded-lg text-sm">Premios</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="p-4"><p className="text-muted text-xs uppercase tracking-wider font-bold">Partidas</p><p className="text-2xl font-bold mt-1">{total}</p></Card>
        <Card className="p-4 border-green-500/20"><p className="text-muted text-xs uppercase tracking-wider font-bold">Victorias</p><p className="text-2xl font-bold mt-1 text-green-400">{wins}</p></Card>
        <Card className="p-4"><p className="text-muted text-xs uppercase tracking-wider font-bold">Win Rate</p><p className="text-2xl font-bold mt-1 text-gold">{winRate}%</p></Card>
        <Card className="p-4"><p className="text-muted text-xs uppercase tracking-wider font-bold">Premios</p><p className="text-2xl font-bold mt-1 text-blue-accent">{claimedCount}</p></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Match History */}
        <Card className="md:col-span-2 p-5">
          <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
            <Swords className="w-5 h-5" />
            Historial de Partidas
          </h2>
          {matchResults.length === 0 ? (
            <div className="text-center py-10 text-muted">
              <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Aún no has jugado ninguna partida</p>
            </div>
          ) : (
            <>
              {/* Stats mini bar */}
              <div className="flex gap-3 mb-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> {wins} ganadas</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> {total - wins} perdidas</span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {matchResults.map((r) => {
                  const isWin = r.result === "WON";
                  const oppId = r.match.team1Id === null ? r.match.team2Id : r.match.team1Id === r.userId ? r.match.team2Id : r.match.team1Id;
                  const oppName = oppId ? nameMap.get(oppId) || oppId.slice(0, 8) : "---";

                  return (
                    <div key={r.id} className={`flex items-center justify-between py-3 px-3 rounded-lg border transition-colors ${
                      isWin ? "border-green-500/20 bg-green-500/5" : "border-border bg-background"
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isWin ? "bg-green-400" : "bg-red-400"}`} />
                          <p className="text-sm font-medium truncate">{r.match.round.tournament.name}</p>
                        </div>
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                          <Gamepad2 className="w-3 h-3" />
                          {r.match.round.tournament.game?.replace(/_/g, " ") || "General"}
                          <span className="w-1 h-1 rounded-full bg-muted" />
                          vs {oppName}
                        </p>
                      </div>
                      <Badge variant={isWin ? "green" : "red"} className="shrink-0 ml-2">
                        {isWin ? "VICTORIA" : "DERROTA"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <Link href={`/players/${session.user.id}`} className="text-gold hover:underline text-xs mt-3 inline-block">
                Ver historial completo →
              </Link>
            </>
          )}
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Teams */}
          <Card className="p-5">
            <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              Mis Equipos
            </h2>
            {memberships.length === 0 ? (
              <div className="text-center py-6 text-muted text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No estás en ningún equipo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberships.map((m) => (
                  <Link key={m.id} href={`/teams/${m.team.id}`} className="block py-2 px-3 rounded-lg hover:bg-background transition-colors">
                    <p className="font-medium text-sm">{m.team.name}</p>
                    <p className="text-xs text-muted">{m.team.captainId === session.user.id ? "Capitán" : "Miembro"}</p>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/teams/create" className="text-gold hover:underline text-xs mt-2 inline-block">
              + Crear equipo
            </Link>
          </Card>

          {/* Tournaments */}
          <Card className="p-5">
            <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" />
              Mis Registros
            </h2>
            {registrations.length === 0 ? (
              <p className="text-muted text-sm">No estás registrado en torneos</p>
            ) : (
              <div className="space-y-2">
                {registrations.slice(0, 5).map((r) => (
                  <Link key={r.id} href={`/tournaments/${r.tournament.id}`} className="block py-2 px-3 rounded-lg hover:bg-background transition-colors">
                    <p className="text-sm font-medium">{r.tournament.name}</p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.tournament.eventDate).toLocaleDateString("es-MX")}
                    </p>
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
