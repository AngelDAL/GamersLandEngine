import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canManageTournament } from "@/lib/tournament-server";
import { TournamentDetailClient } from "./TournamentDetailClient";
import { statusLabels } from "../page";
import {
  Sword, Crosshair, Zap, Target, Gamepad2, MapPin, Calendar,
  DollarSign, Swords, Users, ClipboardList, ArrowRight, Medal, Clock,
  ChevronRight, UserCog,
} from "lucide-react";

const gameConfig: Record<string, { icon: typeof Sword; gradient: string; label: string }> = {
  LEAGUE_OF_LEGENDS: { icon: Sword, gradient: "from-blue-900/90 via-blue-800/50 to-background", label: "League of Legends" },
  VALORANT: { icon: Crosshair, gradient: "from-red-900/90 via-red-800/50 to-background", label: "Valorant" },
  FORTNITE: { icon: Zap, gradient: "from-purple-900/90 via-purple-800/50 to-background", label: "Fortnite" },
  LOL_1V1: { icon: Target, gradient: "from-amber-900/90 via-amber-800/50 to-background", label: "LoL 1v1" },
};

function getGameConfig(game: string) {
  const key = game?.toUpperCase().replace(/[\s-]+/g, "_") || "";
  return gameConfig[key] || { icon: Gamepad2, gradient: "from-[#0A0E1A]/90 via-[#141B2D]/50 to-background", label: game || "Torneo" };
}

/**
 * Se calcula fuera del render (Date.now es impuro para el análisis de React):
 * la página es dinámica, por lo que se evalúa en cada petición.
 */
function isDeadlinePassed(deadline: Date | null): boolean {
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}

const bracketLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Eliminación simple",
  DOUBLE_ELIMINATION: "Doble eliminación",
  ROUND_ROBIN: "Round robin",
  SWISS: "Suizo",
};

/** Chip de estado con color propio por valor (sin jerga: siempre la etiqueta en español). */
function StatusChip({ status }: { status: string }) {
  const tone: Record<string, string> = {
    OPEN_REGISTRATION: "text-green-400 border-green-500/40 bg-green-500/10",
    IN_PROGRESS: "text-[#35C4DC] border-blue-accent/50 bg-blue-accent/10",
    COMPLETED: "text-muted border-border bg-surface",
    CLOSED: "text-muted border-border bg-surface",
    DRAFT: "text-gold border-gold/40 bg-gold/10",
    CANCELLED: "text-red-400 border-red-500/40 bg-red-500/10",
  };
  return (
    <span className={`inline-flex items-center gap-2 h-6.5 px-3 rounded-full border text-[11px] font-bold uppercase tracking-wider ${tone[status] || "text-muted border-border bg-surface"}`}>
      {status === "IN_PROGRESS" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-accent animate-pulse" />
      )}
      {statusLabels[status] || status}
    </span>
  );
}

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
              winner: { select: { id: true, name: true } },
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

  const game = getGameConfig(tournament.game);
  const isAdmin = await canManageTournament(id, session);
  const userReg = session?.user?.id
    ? await prisma.tournamentRegistration.findUnique({
        where: { tournamentId_userId: { tournamentId: id, userId: session.user.id } },
        select: { id: true, status: true, paid: true, checkedInAt: true },
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

  // Nombres de participantes para la vista previa de la llave
  const registeredPlayers = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: id },
    include: { user: { select: { id: true, username: true } } },
  });

  const isTeamBased = tournament.isTeamBased !== false;

  // Mismo criterio de cupo que la API: individual → inscripciones PENDING +
  // CONFIRMED; por equipos → equipos confirmados + equipos con solicitud
  // pendiente (cada equipo cuenta una sola vez).
  let entrants: number;
  if (isTeamBased) {
    const pendingTeamRegs = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: id, status: "PENDING", teamId: { not: null } },
      select: { teamId: true },
    });
    const confirmedTeamIds = new Set(tournament.tournamentTeams.map((tt) => tt.teamId));
    const pendingOnly = new Set(
      pendingTeamRegs.map((r) => r.teamId!).filter((tid) => !confirmedTeamIds.has(tid)),
    );
    entrants = confirmedTeamIds.size + pendingOnly.size;
  } else {
    entrants = await prisma.tournamentRegistration.count({
      where: { tournamentId: id, status: { in: ["PENDING", "CONFIRMED"] } },
    });
  }
  const slotsFull = entrants >= tournament.maxTeams;
  const deadlinePassed = isDeadlinePassed(tournament.registrationDeadline);

  const userTeams = session?.user?.id
    ? (
        await prisma.teamMember.findMany({
          where: { userId: session.user.id, status: "ACTIVE" },
          select: { team: { select: { id: true, name: true } } },
          orderBy: { team: { name: "asc" } },
        })
      ).map((m) => m.team)
    : [];

  const totalRounds = tournament.rounds.length;

  const nameMap = new Map<string, string>();
  for (const t of teams) nameMap.set(t.id, t.name);
  for (const r of registeredPlayers) nameMap.set(r.user.id, r.user.username);

  const userId = session?.user?.id;
  const userTeamId = userTeamMember?.team?.id;
  const isUserInMatch = (match: { team1Id: string | null; team2Id: string | null }) =>
    isTeamBased
      ? match.team1Id === userTeamId || match.team2Id === userTeamId
      : match.team1Id === userId || match.team2Id === userId;

  const isOpen = tournament.status === "OPEN_REGISTRATION";

  const eventDateLabel = new Date(tournament.eventDate).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });
  const eventTimeLabel = new Date(tournament.eventDate).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const detailTags = [
    isTeamBased ? `${tournament.teamSize} contra ${tournament.teamSize}` : "Individual",
    bracketLabels[tournament.bracketType] || tournament.bracketType,
    `Cupo: ${tournament.maxTeams}`,
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Portada ── */}
      <header className="relative min-h-[290px] md:min-h-[340px] flex items-end overflow-hidden border-b border-border">
        {tournament.imageUrl ? (
          <img
            src={tournament.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient}`} />
        )}
        {/* Degradados: abajo al fondo y desde la izquierda para que el texto
            siempre caiga sobre zona oscura, sin depender del recorte del arte. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-transparent" />

        <div className="relative w-full max-w-6xl mx-auto px-4 pt-8 pb-7">
          <div className="flex flex-wrap items-center gap-2 mb-3.5">
            <span className="inline-flex items-center gap-1.5 h-6.5 px-3 rounded-full border border-gold/40 bg-gold/10 text-[11px] font-bold uppercase tracking-wider text-gold">
              {game.label}
            </span>
            <StatusChip status={tournament.status} />
            <span className="inline-flex items-center h-6.5 px-3 rounded-full border border-border bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
              {bracketLabels[tournament.bracketType] || tournament.bracketType}
            </span>
            {totalRounds > 0 && (
              <span className="inline-flex items-center h-6.5 px-3 rounded-full border border-border bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
                {totalRounds} rondas
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-foreground drop-shadow-lg mb-4">
            {tournament.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#B9C4D4] mb-5">
            <span className="inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted" />
              {eventDateLabel} · {eventTimeLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted" />
              {tournament.location || "Por definir"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              {entrants} de {tournament.maxTeams} {isTeamBased ? "equipos" : "jugadores"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/tournaments/${id}/bracket`}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-gold text-background font-bold text-sm hover:bg-gold-hover transition-colors"
            >
              <Swords className="w-4 h-4" /> Ver llave
            </Link>
            {isOpen && (
              <a
                href="#inscripcion"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg border border-gold/50 text-gold font-bold text-sm hover:bg-gold/10 transition-colors"
              >
                Inscribirme
              </a>
            )}
            {isAdmin && (
              <Link
                href={`/tournaments/${id}/manage`}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg border border-border bg-surface/80 text-foreground font-bold text-sm hover:border-gold/40 transition-colors"
              >
                <ClipboardList className="w-4 h-4" /> Gestionar
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Barra de datos ── */}
      <div className="max-w-6xl mx-auto px-4 -mt-7 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Fecha</p>
              <p className="font-semibold text-sm leading-snug">{eventDateLabel} · {eventTimeLabel}</p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Ubicación</p>
              <p className="font-semibold text-sm leading-snug line-clamp-2" title={tournament.location || undefined}>
                {tournament.location || "Por definir"}
              </p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Participantes</p>
              <p className="font-semibold text-sm">{entrants} de {tournament.maxTeams}</p>
              <div className="w-full h-1.5 bg-[#26344F] rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-accent rounded-full transition-all"
                  style={{ width: `${Math.min(100, (entrants / tournament.maxTeams) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Cuota</p>
              <p className="font-semibold text-sm">
                {tournament.entryFee ? `$${Number(tournament.entryFee)} MXN` : "Gratuito"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido: columna principal + lateral ── */}
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_336px] gap-6 items-start mt-7 pb-16">
        <main className="flex flex-col gap-6 min-w-0">
          {/* El torneo */}
          <section className="bg-surface border border-border rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-1 h-[18px] rounded-full bg-gold" />
              <h2 className="text-lg font-bold">El torneo</h2>
            </div>
            {tournament.description ? (
              <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
                {tournament.description}
              </p>
            ) : (
              <p className="text-muted text-sm">Sin descripción por el momento.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-5">
              {detailTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-semibold text-muted border border-border bg-background px-3 py-1.5 rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* Premios */}
          {tournament.prizes.length > 0 && (
            <section className="bg-surface border border-border rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-[18px] rounded-full bg-gold" />
                  <h2 className="text-lg font-bold">Premios</h2>
                </div>
                <Link href="/prizes" className="inline-flex items-center gap-1 text-sm text-[#35C4DC] font-semibold hover:underline">
                  Ver todos <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div>
                {tournament.prizes.map((prize) => (
                  <div key={prize.id} className="flex items-center gap-4 py-3.5 border-t border-border first:border-t-0">
                    <div
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center font-black text-sm shrink-0 ${
                        prize.position === 1
                          ? "bg-gradient-to-br from-[#3d3218] to-[#241d0d] border-gold/50 text-gold shadow-lg shadow-gold/10"
                          : prize.position === 2
                            ? "bg-[#1B2539] border-border2 text-[#B9C4D4]"
                            : prize.position === 3
                              ? "bg-[#241c14] border-amber-800/40 text-amber-500"
                              : "bg-background border-border text-muted"
                      }`}
                      aria-hidden
                    >
                      {prize.position ? prize.position : <Medal className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{prize.name}</p>
                      {prize.description && (
                        <p className="text-xs text-muted truncate">{prize.description}</p>
                      )}
                    </div>
                    <p className="ml-auto font-extrabold text-gold text-sm text-right shrink-0">
                      {prize.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Llave — vista previa */}
          {totalRounds > 0 && (
            <section className="bg-surface border border-border rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-[18px] rounded-full bg-gold" />
                  <h2 className="text-lg font-bold">Llave</h2>
                </div>
                <Link
                  href={`/tournaments/${id}/bracket`}
                  className="inline-flex items-center gap-1 text-sm text-[#35C4DC] font-semibold hover:underline"
                >
                  Ver llave completa <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="overflow-x-auto pb-2 -mx-1">
                <div className="flex gap-1 px-1 min-w-max">
                  {tournament.rounds.map((round, ri) => (
                    <Fragment key={round.id}>
                      <div className="flex flex-col min-w-[190px] sm:min-w-[220px]">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest text-center mb-1">
                          Ronda {round.roundNumber}
                        </p>
                        <div className="flex flex-col gap-2 flex-1 justify-around">
                        {round.matches.map((match) => {
                          const t1Name = nameMap.get(match.team1Id || "") || "Por definir";
                          const t2Name = nameMap.get(match.team2Id || "") || "Por definir";
                          const isUser = userId ? isUserInMatch(match) : false;

                          return (
                            <div
                              key={match.id}
                              className={`bg-background border rounded-lg overflow-hidden text-xs ${
                                match.winnerId
                                  ? "border-green-500/30"
                                  : isUser
                                    ? "border-gold/50 ring-1 ring-gold/30"
                                    : "border-border"
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2 px-3 py-2.5 ${
                                  match.winnerId === match.team1Id ? "bg-green-500/10" : ""
                                }`}
                              >
                                <span
                                  className={`font-bold truncate ${
                                    match.winnerId === match.team1Id
                                      ? "text-green-400"
                                      : isUser && match.team1Id === (isTeamBased ? userTeamId : userId)
                                        ? "text-gold"
                                        : "text-foreground"
                                  }`}
                                >
                                  {match.team1Id ? t1Name : "Por definir"}
                                </span>
                                <span className="ml-auto font-black tabular-nums text-muted">
                                  {match.status === "COMPLETED" ? (match.score1 ?? 0) : match.winnerId === match.team1Id ? "W" : ""}
                                </span>
                              </div>
                              <div className="h-px bg-border relative">
                                {match.status !== "COMPLETED" && (
                                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-1.5 text-[9px] font-black text-muted tracking-widest">
                                    VS
                                  </span>
                                )}
                              </div>
                              <div
                                className={`flex items-center gap-2 px-3 py-2.5 ${
                                  match.winnerId === match.team2Id ? "bg-green-500/10" : ""
                                }`}
                              >
                                <span
                                  className={`font-bold truncate ${
                                    match.winnerId === match.team2Id
                                      ? "text-green-400"
                                      : isUser && match.team2Id === (isTeamBased ? userTeamId : userId)
                                        ? "text-gold"
                                        : "text-foreground"
                                  }`}
                                >
                                  {match.team2Id ? t2Name : "Por definir"}
                                </span>
                                <span className="ml-auto font-black tabular-nums text-muted">
                                  {match.status === "COMPLETED" ? (match.score2 ?? 0) : match.winnerId === match.team2Id ? "W" : ""}
                                </span>
                              </div>
                              {match.scheduledAt && (
                                <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {new Date(match.scheduledAt).toLocaleDateString("es-MX", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                      {ri < tournament.rounds.length - 1 && (
                        <div className="hidden sm:flex items-center self-center text-[#3B4E6E] pb-6">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
              <p className="sm:hidden text-[11px] text-muted text-center mt-2">
                Desliza para ver más rondas
              </p>
            </section>
          )}
        </main>

        {/* Lateral: inscripción (cliente), organizadores, equipos */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px] min-w-0">
          <div id="inscripcion" className="scroll-mt-24">
            {/* Estado de inscripción y próximos pasos (lógica del cliente) */}
            <TournamentDetailClient
              tournamentId={tournament.id}
              tournamentStatus={tournament.status}
              tournamentName={tournament.name}
              eventDate={tournament.eventDate.toISOString()}
              session={session ? { id: session.user.id, name: session.user.name, role: session.user.role } : null}
              registration={
                userReg ? { ...userReg, checkedInAt: userReg.checkedInAt?.toISOString() ?? null } : null
              }
              userTeamMember={userTeamMember}
              isTeamBased={tournament.isTeamBased !== false}
              userTeams={userTeams}
              slotsFull={slotsFull}
              deadlinePassed={deadlinePassed}
              rounds={(tournament.rounds || []).map((r) => ({
                id: r.id,
                roundNumber: r.roundNumber,
                matches: (r.matches || []).map((m) => ({
                  id: m.id,
                  team1Id: m.team1Id,
                  team2Id: m.team2Id,
                  winnerId: m.winnerId,
                  status: m.status,
                  score1: m.score1,
                  score2: m.score2,
                  scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
                  bracketPosition: m.bracketPosition,
                })),
              }))}
              allParticipants={[
                ...teams.map((t) => ({ id: t.id, name: t.name })),
                ...registeredPlayers.map((r) => ({ id: r.user.id, name: r.user.username })),
              ]}
            />
          </div>

          {tournament.organizers.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[11px] text-muted uppercase tracking-wider font-bold mb-1">
                Organizadores
              </p>
              {tournament.organizers.map((org) => (
                <div key={org.id} className="flex items-center gap-3 py-2">
                  <span className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 text-gold font-bold text-xs flex items-center justify-center shrink-0">
                    {org.user.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{org.user.username}</p>
                    <p className="text-xs text-[#9FB0C6]">Organizador</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {teams.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[11px] text-muted uppercase tracking-wider font-bold mb-2">
                {isTeamBased ? "Equipos inscritos" : "Jugadores inscritos"}
              </p>
              <div className="max-h-64 overflow-y-auto pr-1">
                {teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0">
                    <span className="w-8 h-8 rounded-lg bg-background border border-border text-muted font-bold text-[11px] flex items-center justify-center shrink-0">
                      {t.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm truncate">{t.name}</span>
                    <span className="ml-auto text-[11px] text-[#9FB0C6] shrink-0">
                      {t._count.members} {t._count.members === 1 ? "miembro" : "miembros"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen de torneo para dueño/admin — atajo de gestión */}
          {isAdmin && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-[11px] text-muted uppercase tracking-wider font-bold mb-3">
                Administración
              </p>
              <Link
                href={`/tournaments/${id}/manage`}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gold text-background font-bold text-sm hover:bg-gold-hover transition-colors"
              >
                <UserCog className="w-4 h-4" /> Gestionar torneo
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
