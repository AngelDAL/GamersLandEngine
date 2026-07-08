import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MapPin, DollarSign, Trophy, Clock, Gamepad2 } from "lucide-react";

const gameConfig: Record<string, { gradient: string; label: string; banner: string }> = {
  LEAGUE_OF_LEGENDS: { gradient: "from-blue-900/80 via-blue-800/40 to-transparent", label: "League of Legends", banner: "/banners/lol.svg" },
  VALORANT: { gradient: "from-red-900/80 via-red-800/40 to-transparent", label: "Valorant", banner: "/banners/valorant.svg" },
  FORTNITE: { gradient: "from-purple-900/80 via-purple-800/40 to-transparent", label: "Fortnite", banner: "/banners/fortnite.svg" },
  LOL_1V1: { gradient: "from-amber-900/80 via-amber-800/40 to-transparent", label: "LoL 1v1", banner: "/banners/lol1v1.svg" },
};

const statusStyles: Record<string, string> = {
  OPEN_REGISTRATION: "text-green-400 bg-green-500/10 border-green-500/30",
  IN_PROGRESS: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  COMPLETED: "text-muted bg-surface border-border",
  DRAFT: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  CLOSED: "text-red-400 bg-red-500/10 border-red-500/30",
  CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  OPEN_REGISTRATION: "Abierto",
  IN_PROGRESS: "En vivo",
  COMPLETED: "Finalizado",
  DRAFT: "Planeación",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

function getGameConfig(game: string) {
  const key = game?.toUpperCase().replace(/[\s-]+/g, "_") || "";
  return gameConfig[key] || { gradient: "from-[#0A0E1A]/80 via-[#141B2D]/40 to-transparent", label: game || "Torneo", banner: "/banners/default.svg" };
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// ── Card component to reduce duplication ──
function TournamentCard({ tournament, link, game, topPrize, nextMatch, isCompleted, hideStatus }: {
  tournament: any; link: string; game: ReturnType<typeof getGameConfig>;
  topPrize: any; nextMatch: any; isCompleted: boolean; hideStatus?: boolean;
}) {
  const t = tournament;
  return (
    <Link key={t.id} href={link} className="group">
      <div className="bg-surface border border-border rounded-xl overflow-hidden hover:border-gold/50 hover:shadow-xl hover:shadow-gold/5 transition-all duration-200 h-full flex flex-col">
        <div className="relative h-28 overflow-hidden">
          <img src={t.imageUrl || game.banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
          {!hideStatus && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0xaDEyek0zNiAyNHYySDI0di0xaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />}
          <div className="relative h-full flex items-end p-4">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm drop-shadow-lg">{game.label}</span>
              {isCompleted && <Badge variant="gold" className="text-[10px]">✓ Completado</Badge>}
            </div>
          </div>
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-foreground group-hover:text-gold transition-colors">{t.name}</h3>
            {!hideStatus && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${statusStyles[t.status] || ""}`}>
                {statusLabels[t.status] || t.status}
              </span>
            )}
          </div>

          {nextMatch !== undefined && (
            <div className="bg-background border border-border rounded-lg p-3 mb-3">
              {isCompleted ? (
                <p className="text-xs text-muted text-center">🏆 Torneo finalizado</p>
              ) : nextMatch ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gold font-bold uppercase tracking-wider">Próximo partido</p>
                  {nextMatch.scheduledAt ? (
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <Calendar className="w-3 h-3 text-gold shrink-0" />
                      <span>{fmtDate(nextMatch.scheduledAt)}</span>
                      <Clock className="w-3 h-3 text-gold ml-1 shrink-0" />
                      <span>{fmtTime(nextMatch.scheduledAt)}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Sin horario asignado</p>
                  )}
                  {t.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{t.location}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">Esperando bracket...</p>
              )}
            </div>
          )}

          <div className="space-y-1.5 text-xs text-muted flex-1">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{t._count.registrations} / {t.maxTeams} registrados</div>
            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{fmtDate(t.eventDate)}</div>
            {t.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{t.location}</div>}
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
            <div className="flex items-center gap-1 text-gold text-xs font-bold">
              <DollarSign className="w-3 h-3" />{t.entryFee ? `$${Number(t.entryFee)}` : "Gratis"}
            </div>
            {topPrize && (
              <div className="flex items-center gap-1 text-xs text-green-400"><Trophy className="w-3 h-3" />{topPrize.value}</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function TournamentsPage() {
  const session = await auth();
  const canManage = session?.user && (session.user.role === "ADMIN" || session.user.role === "ORGANIZER");

  const tournaments = await prisma.tournament.findMany({
    where: canManage ? {} : { status: { not: "DRAFT" } },
    include: {
      createdBy: { select: { username: true } },
      prizes: { where: { position: 1 }, take: 1 },
      _count: { select: { registrations: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  // ── User's registered tournaments with next match ──
  let myTournaments: any[] = [];
  if (session?.user?.id) {
    const regs = await prisma.tournamentRegistration.findMany({
      where: { userId: session.user.id },
      select: { tournamentId: true, status: true },
    });
    const regIds = regs.map(r => r.tournamentId);

    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map(m => m.teamId);
    const tournamentTeams = teamIds.length > 0
      ? await prisma.tournamentTeam.findMany({ where: { teamId: { in: teamIds } }, select: { tournamentId: true } })
      : [];
    const teamTournamentIds = tournamentTeams.map(tt => tt.tournamentId);

    const uniqueIds = [...new Set([...regIds, ...teamTournamentIds])];
    const allMyTeamIds = [...new Set(teamIds)];

    if (uniqueIds.length > 0) {
      myTournaments = await prisma.tournament.findMany({
        where: { id: { in: uniqueIds } },
        include: {
          prizes: { where: { position: 1 }, take: 1 },
          _count: { select: { registrations: true } },
        },
      });

      // Find next pending match — check both userId AND teamId
      const orConditions: any[] = [
        { team1Id: session.user.id },
        { team2Id: session.user.id },
      ];
      if (allMyTeamIds.length > 0) {
        orConditions.push({ team1Id: { in: allMyTeamIds } });
        orConditions.push({ team2Id: { in: allMyTeamIds } });
      }
      const userMatchQuery = await prisma.match.findMany({
        where: {
          OR: orConditions,
          status: { not: "COMPLETED" },
          round: { tournamentId: { in: uniqueIds } },
        },
        select: { id: true, scheduledAt: true, status: true, roundId: true, round: { select: { tournamentId: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      });

      const matchByTournament: Record<string, any> = {};
      for (const m of userMatchQuery) {
        const tid = m.round.tournamentId;
        if (!matchByTournament[tid]) matchByTournament[tid] = m;
      }

      myTournaments = myTournaments.map(t => ({
        ...t,
        nextMatch: matchByTournament[t.id] || null,
      }));
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-foreground">Torneos</h1>
          <p className="text-xs text-muted mt-0.5">{tournaments.length} torneo{tournaments.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Link href="/tournaments/create" className="px-5 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-all shadow-lg shadow-gold/20">
            + Crear Torneo
          </Link>
        )}
      </div>

      {/* ═══════════ MIS TORNEOS ═══════════ */}
      {myTournaments.length > 0 && (
        <div className="mb-8 p-4 sm:p-6 bg-gold/[0.03] border border-gold/20 rounded-2xl">
          <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
            <Gamepad2 className="w-5 h-5" />
            Mis torneos
            <span className="text-xs text-muted font-normal">({myTournaments.length})</span>
          </h2>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myTournaments.map((t: any) => {
              const game = getGameConfig(t.game);
              const link = `/tournaments/${t.id}`;
              return (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  link={link}
                  game={game}
                  topPrize={t.prizes?.[0]}
                  nextMatch={t.nextMatch}
                  isCompleted={t.status === "COMPLETED"}
                  hideStatus
                />
              );
            })}
          </div>
        </div>
      )}

      {myTournaments.length > 0 && <hr className="border-border mb-8" />}
      {/* ═══════════ TORNEOS DISPONIBLES ═══════════ */}
      <div>
        {myTournaments.length > 0 && (
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5" />
            Torneos disponibles
          </h2>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <Trophy className="w-16 h-16 text-muted mx-auto mb-4 opacity-30" />
              <p className="text-muted text-lg font-medium">No hay torneos</p>
            </div>
          ) : (
            tournaments.map((t) => {
              const game = getGameConfig(t.game);
              const topPrize = t.prizes[0];
              const link = canManage ? `/tournaments/${t.id}/manage` : `/tournaments/${t.id}`;
              return (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  link={link}
                  game={game}
                  topPrize={topPrize}
                  nextMatch={undefined}
                  isCompleted={false}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
