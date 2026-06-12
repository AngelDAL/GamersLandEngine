import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { TournamentDetailClient } from "./TournamentDetailClient";
import {
  Sword, Crosshair, Zap, Target, Gamepad2, MapPin, Calendar, Trophy,
  DollarSign, Swords, Users, ClipboardList, ArrowRight, Medal,
} from "lucide-react";

const gameConfig: Record<string, { icon: typeof Sword; gradient: string; label: string }> = {
  LEAGUE_OF_LEGENDS: { icon: Sword, gradient: "from-blue-900/90 via-blue-800/50 to-background", label: "League of Legends" },
  VALORANT: { icon: Crosshair, gradient: "from-red-900/90 via-red-800/50 to-background", label: "Valorant" },
  FORTNITE: { icon: Zap, gradient: "from-purple-900/90 via-purple-800/50 to-background", label: "Fortnite" },
  LOL_1V1: { icon: Target, gradient: "from-amber-900/90 via-amber-800/50 to-background", label: "LoL 1v1" },
};

const bracketLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Eliminación Simple",
  DOUBLE_ELIMINATION: "Doble Eliminación",
  ROUND_ROBIN: "Round Robin",
  SWISS: "Suizo",
};

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true } },
      organizers: { include: { user: { select: { username: true } } } },
      prizes: { orderBy: { position: "asc" } },
      tournamentTeams: {
        include: {
          team: {
            include: {
              captain: { select: { id: true, username: true } },
              members: { where: { status: "ACTIVE" }, select: { status: true } },
              _count: { select: { members: { where: { status: "ACTIVE" } } } },
            },
          },
        },
      },
      rounds: {
        include: {
          matches: {
            include: {
              team1: { select: { id: true, name: true } },
              team2: { select: { id: true, name: true } },
            },
            take: 2,
          },
        },
        orderBy: { roundNumber: "asc" },
        take: 3,
      },
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) notFound();

  const game = gameConfig[tournament.game] || gameConfig.LEAGUE_OF_LEGENDS;
  const Icon = game.icon;
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "ORGANIZER";
  const userReg = session?.user?.id
    ? await prisma.tournamentRegistration.findUnique({
        where: { tournamentId_userId: { tournamentId: id, userId: session.user.id } },
      })
    : null;
  const userTeamMember = session?.user?.id
    ? await prisma.teamMember.findFirst({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } } },
      })
    : null;

  const teams = tournament.tournamentTeams.map((tt) => ({
    id: tt.team.id,
    name: tt.team.name,
    captainId: tt.team.captainId,
    captain: tt.team.captain,
    _count: { members: tt.team._count.members },
    members: tt.team.members,
  }));

  const totalRounds = tournament.rounds.length;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Banner ── */}
      <div className={`relative h-48 md:h-64 bg-gradient-to-br ${game.gradient} overflow-hidden`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 h-full flex items-end pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center">
              <Icon className="w-7 h-7 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black text-white drop-shadow-lg">{tournament.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 mt-1">
                <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5" />{game.label}</span>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span>{bracketLabels[tournament.bracketType]}</span>
                {totalRounds > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span>{totalRounds} rondas</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative">
        {/* ── Admin Link ── */}
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <Link
              href={`/tournaments/${id}/manage`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-background font-bold rounded-lg text-sm hover:bg-gold-hover transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Gestionar Torneo
            </Link>
          </div>
        )}

        {/* ── Info Cards ── */}
        <div className="grid gap-3 md:grid-cols-4 mb-8">
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Fecha</p>
              <p className="font-semibold text-sm truncate">
                {new Date(tournament.eventDate).toLocaleDateString("es-MX", {
                  day: "numeric", month: "long",
                })}
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Ubicación</p>
              <p className="font-semibold text-sm truncate">{tournament.location || "Por definir"}</p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Participantes</p>
              <p className="font-semibold text-sm">{tournament._count.registrations} / {tournament.maxTeams}</p>
              <div className="w-full h-1 bg-background rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.min(100, (tournament._count.registrations / tournament.maxTeams) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Cuota</p>
              <p className="font-semibold text-sm">{tournament.entryFee ? `$${Number(tournament.entryFee)}` : "Gratuito"}</p>
            </div>
          </div>
        </div>

        {/* ── Client Section (registration, teams, modals) ── */}
        <TournamentDetailClient
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          session={session ? { id: session.user.id, name: session.user.name, role: session.user.role } : null}
          registration={userReg}
          teams={teams}
          freeAgents={[]}
          userTeamMember={userTeamMember}
          isTeamBased={tournament.isTeamBased !== false}
        />

        {/* ── Description ── */}
        {tournament.description && (
          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5" />
              Detalles del torneo
            </h2>
            <p className="text-muted text-sm whitespace-pre-line">{tournament.description}</p>
          </div>
        )}

        {/* ── Prizes ── */}
        {tournament.prizes.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" />
              Premios
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {tournament.prizes.map((prize) => (
                <div key={prize.id} className="bg-background border border-border rounded-xl p-4 text-center hover:border-gold/30 transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2
                    ${prize.position === 1 ? 'bg-yellow-500/20' : prize.position === 2 ? 'bg-gray-400/20' : prize.position === 3 ? 'bg-amber-700/20' : 'bg-gold/10'}">
                    <Medal className={`w-5 h-5 ${
                      prize.position === 1 ? 'text-yellow-400' :
                      prize.position === 2 ? 'text-gray-300' :
                      prize.position === 3 ? 'text-amber-600' : 'text-gold'
                    }`} />
                  </div>
                  <h3 className="font-bold text-sm">{prize.name}</h3>
                  {prize.description && <p className="text-xs text-muted mt-1">{prize.description}</p>}
                  <p className="text-gold font-bold text-sm mt-2">{prize.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bracket Preview ── */}
        {totalRounds > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gold flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Bracket
              </h2>
              <Link
                href={`/tournaments/${id}/bracket`}
                className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
              >
                Ver completo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {tournament.rounds.map((round) => (
                <div key={round.id} className="min-w-[160px] space-y-2">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-wider text-center mb-2">
                    Ronda {round.roundNumber}
                  </p>
                  {round.matches.map((match) => (
                    <div key={match.id} className="bg-background border border-border rounded-lg p-2.5 text-xs">
                      <p className="font-medium truncate">{match.team1?.name || "---"}</p>
                      <p className="text-muted text-[10px] text-center">vs</p>
                      <p className="font-medium truncate">{match.team2?.name || "---"}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
