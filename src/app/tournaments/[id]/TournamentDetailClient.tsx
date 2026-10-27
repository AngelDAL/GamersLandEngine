"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RegisterModal } from "./_components/RegisterModal";
import { MatchCountdown } from "@/components/notifications/MatchCountdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UserPlus, CheckCircle, LogIn, Swords, Users,
  ArrowRight, Trophy, Loader2, X, Clock,
} from "lucide-react";
import Link from "next/link";

type Participant = { id: string; name: string };
type Match = {
  id: string;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  score1: number | null;
  score2: number | null;
  status: string;
  scheduledAt: string | null;
  bracketPosition: number | null;
};
type Round = { id: string; roundNumber: number; matches: Match[] };

type RegistrationInfo = {
  id: string;
  status: string;
  paid: boolean;
  checkedInAt: string | null;
} | null;

type Props = {
  tournamentId: string;
  tournamentStatus: string;
  tournamentName: string;
  eventDate: string;
  session: { id: string; name: string; role: string } | null;
  registration: RegistrationInfo;
  userTeamMember: { team: { id: string; name: string } } | null;
  isTeamBased: boolean;
  userTeams: { id: string; name: string }[];
  slotsFull: boolean;
  deadlinePassed: boolean;
  rounds: Round[];
  allParticipants: Participant[];
};

export function TournamentDetailClient({
  tournamentId, tournamentStatus, tournamentName, eventDate, session, registration,
  userTeamMember, isTeamBased, userTeams, slotsFull, deadlinePassed,
  rounds, allParticipants,
}: Props) {
  const router = useRouter();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(userTeams[0]?.id ?? null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string } | null>(null);

  const isEventDay = useMemo(() => {
    const today = new Date();
    const event = new Date(eventDate);
    return (
      today.getFullYear() === event.getFullYear() &&
      today.getMonth() === event.getMonth() &&
      today.getDate() === event.getDate()
    );
  }, [eventDate]);

  const isOpen = tournamentStatus === "OPEN_REGISTRATION";
  const isLive = tournamentStatus === "IN_PROGRESS" || tournamentStatus === "COMPLETED";
  const isRegistered = !!registration;
  const hasRounds = rounds.length > 0;
  const regStatus: string | null = registration?.status ?? null;
  const blockedReason = !isOpen
    ? null
    : slotsFull
      ? "Cupo completo"
      : deadlinePassed
        ? "Fecha límite vencida"
        : null;

  const resolveName = (id: string) => allParticipants.find((p) => p.id === id)?.name || id.slice(0, 8);

  // Busca el próximo partido del usuario (sin memo: los arreglos de props se
  // reconstruyen en cada petición y React Compiler no puede preservarlo).
  let nextMatch: (Match & { roundNumber: number; p1: Participant | null; p2: Participant | null }) | null = null;
  if (session?.id) {
    const userId = session.id;
    const userTeamId = isTeamBased && userTeamMember ? userTeamMember.team.id : null;
    // Se recorren las rondas al revés: la ronda más alta donde aparece el
    // usuario es su partido actual.
    for (let ri = rounds.length - 1; ri >= 0 && !nextMatch; ri--) {
      const round = rounds[ri];
      for (const match of round.matches) {
        if (match.status === "COMPLETED") continue;
        const isParticipant = isTeamBased
          ? match.team1Id === userTeamId || match.team2Id === userTeamId
          : match.team1Id === userId || match.team2Id === userId;
        if (isParticipant) {
          nextMatch = {
            ...match,
            roundNumber: round.roundNumber,
            p1: allParticipants.find((p) => p.id === match.team1Id) || null,
            p2: allParticipants.find((p) => p.id === match.team2Id) || null,
          };
          break;
        }
      }
    }
  }

  const handleAutoRegister = async () => {
    setRegistrationLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isTeamBased ? { teamId: selectedTeamId } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: "error", msg: data.error || "No se pudo enviar la solicitud" });
      } else {
        setFeedback({ type: "ok", msg: "Solicitud enviada — pendiente de aprobación" });
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", msg: "Error de conexión al enviar la solicitud" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckinLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: "error", msg: data.error || "No se pudo registrar la asistencia" });
      } else {
        setFeedback({ type: "ok", msg: "Asistencia registrada" });
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", msg: "Error de conexión al registrar la asistencia" });
    } finally {
      setCheckinLoading(false);
    }
  };

  const formatCheckinTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  // ── BRACKET IN PROGRESS / COMPLETED ──
  if (isLive && hasRounds) {
    return (
      <div className="mb-6 space-y-4">
        {/* Next match for registered players */}
        {isRegistered && nextMatch && (
          <Card className="p-5 border-gold/30">
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-5 h-5 text-gold" />
              <h3 className="font-bold text-sm text-foreground">
                {nextMatch.status === "PENDING" ? "Próximo partido" : "Partido actual"}
              </h3>
              <span className="text-[10px] text-muted">Ronda {nextMatch.roundNumber}</span>
            </div>
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-lg font-bold">
                  {nextMatch.p1?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-sm font-bold text-center">{nextMatch.p1?.name || "---"}</span>
              </div>
              <div className="text-lg font-black text-gold">VS</div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-lg font-bold">
                  {nextMatch.p2?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-sm font-bold text-center">{nextMatch.p2?.name || "---"}</span>
              </div>
            </div>
            {nextMatch.scheduledAt && (
              <div className="mt-4">
                <MatchCountdown scheduledAt={nextMatch.scheduledAt} status={nextMatch.status} large />
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-center">
              <Link href={`/tournaments/${tournamentId}/bracket`}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors shadow-lg shadow-gold/20">
                <Swords className="w-4 h-4" /> Ver bracket completo
              </Link>
            </div>
          </Card>
        )}

        {/* Quick bracket preview */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gold flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {tournamentStatus === "COMPLETED" ? "Resultados del torneo" : "Bracket en vivo"}
            </h3>
            <Link href={`/tournaments/${tournamentId}/bracket`}
              className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
              Ver completo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 sm:mx-0">
            <div className="flex gap-3 sm:gap-5 px-4 sm:px-0 min-w-max">
              {rounds.map((round) => (
                <div key={round.id} className="flex flex-col gap-2 min-w-[180px] sm:min-w-[220px]">
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest text-center mb-1">
                    Ronda {round.roundNumber}
                  </p>
                  {round.matches.map((match) => {
                    const t1Name = resolveName(match.team1Id || "");
                    const t2Name = resolveName(match.team2Id || "");
                    const wsDetail = match.winnerId
                      ? (match.winnerId === match.team1Id ? "team1" as const : "team2" as const)
                      : (match.score1 ?? 0) > (match.score2 ?? 0)
                        ? "team1" as const
                        : (match.score2 ?? 0) > (match.score1 ?? 0)
                          ? "team2" as const
                          : null;
                    const isUser = session?.id
                      ? (isTeamBased
                          ? match.team1Id === userTeamMember?.team?.id || match.team2Id === userTeamMember?.team?.id
                          : match.team1Id === session.id || match.team2Id === session.id)
                      : false;
                    return (
                      <div key={match.id} className={`bg-background border rounded-lg p-2.5 sm:p-3 text-xs transition-colors ${
                        wsDetail
                          ? "border-green-500/30"
                          : isUser
                            ? "border-gold/50 bg-gold/5 ring-1 ring-gold/30"
                            : "border-border"
                      }`}>
                        <p className={`font-bold truncate text-sm ${
                          wsDetail === "team1" ? "text-green-400" :
                          isUser && match.team1Id === (isTeamBased ? userTeamMember?.team?.id : session?.id) ? "text-gold" : ""
                        }`}>
                          {match.team1Id ? t1Name : "---"}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted my-1.5">
                          <div className="flex-1 h-px bg-border" />
                          <span className={match.status === "COMPLETED" ? "text-green-400 font-bold" : ""}>
                            {match.status === "COMPLETED" ? `${match.score1 ?? 0} - ${match.score2 ?? 0}` : "VS"}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <p className={`font-bold truncate text-sm ${
                          wsDetail === "team2" ? "text-green-400" :
                          isUser && match.team2Id === (isTeamBased ? userTeamMember?.team?.id : session?.id) ? "text-gold" : ""
                        }`}>
                          {match.team2Id ? t2Name : "---"}
                        </p>
                        {match.scheduledAt && (
                          <p className="text-[8px] text-muted mt-1 text-center">
                            {new Date(match.scheduledAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── OPEN REGISTRATION / NOT STARTED ──
  return (
    <>
      <div className="mb-6 space-y-4">
        {/* Not registered → show CTA */}
        {isOpen && !isRegistered && (
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                  {session ? <Swords className="w-5 h-5 text-gold" /> : <LogIn className="w-5 h-5 text-gold" />}
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {session ? "Inscripciones abiertas" : "¿Quieres jugar?"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{tournamentName}</p>
                </div>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                {/* Selector de equipo (torneos por equipo) */}
                {session && isTeamBased && userTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                    {userTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTeamId(t.id)}
                        aria-pressed={selectedTeamId === t.id}
                        className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold border transition-all ${
                          selectedTeamId === t.id
                            ? "bg-gold text-background border-gold"
                            : "bg-background text-muted border-border hover:border-gold/30"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                {session && isTeamBased && userTeams.length === 0 ? (
                  <div className="flex gap-2">
                    <Link href="/teams/create" className="px-4 py-2.5 min-h-[40px] inline-flex items-center bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors">
                      Crear equipo
                    </Link>
                    <Link href="/free-agents?tab=teams" className="px-4 py-2.5 min-h-[40px] inline-flex items-center border border-gold/50 text-gold font-bold rounded-xl text-sm hover:bg-gold/10 transition-colors">
                      Buscar equipo
                    </Link>
                  </div>
                ) : session ? (
                  blockedReason ? (
                    <Button disabled size="lg" className="w-full sm:w-auto" title={blockedReason}>
                      {blockedReason}
                    </Button>
                  ) : (
                    <Button onClick={handleAutoRegister} disabled={registrationLoading} size="lg" className="w-full sm:w-auto min-h-[44px]">
                      {registrationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                      {registrationLoading ? "ENVIANDO..." : "INSCRIBIRME"}
                    </Button>
                  )
                ) : (
                  <Button onClick={() => setShowRegisterModal(true)} size="lg" className="w-full sm:w-auto min-h-[44px]">
                    <UserPlus className="w-5 h-5" />
                    ENTRAR PARA INSCRIBIRME
                  </Button>
                )}
              </div>
            </div>

            {feedback && (
              <div
                className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
                  feedback.type === "ok"
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                {feedback.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                {feedback.msg}
              </div>
            )}
          </Card>
        )}

        {/* Registered: show status */}
        {isRegistered && (
          <>
            {regStatus === "PENDING" && (
              <Card className="p-5 border-gold/30 text-center">
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-gold" />
                </div>
                <Button
                  disabled
                  size="lg"
                  className="w-full sm:w-auto mb-1"
                  title="El organizador revisará tu solicitud"
                >
                  Solicitud en revisión
                </Button>
                <p className="text-xs text-muted mt-1">{tournamentName}</p>
              </Card>
            )}

            {regStatus === "REJECTED" && (
              <Card className="p-5 border-red-500/30 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-bold text-red-400 text-sm">Tu solicitud de inscripción fue rechazada</p>
                <p className="text-xs text-muted mt-1">{tournamentName}</p>
              </Card>
            )}

            {regStatus === "CONFIRMED" && (
              <>
            {/* Check-in & payment status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Check-in */}
              {registration?.checkedInAt ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Check-in a las {formatCheckinTime(registration.checkedInAt)}
                </span>
              ) : isEventDay ? (
                <button
                  onClick={handleCheckin}
                  disabled={checkinLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {checkinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Hacer check-in
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-muted/10 border border-border text-muted">
                  <Clock className="w-3.5 h-3.5" /> Check-in el día del evento
                </span>
              )}

              {/* Payment badge (only show if paid) */}
              {registration?.paid && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Cuota pagada
                </span>
              )}
            </div>

            {/* Payment info (when not paid) */}
            {!registration?.paid && (
              <p className="text-xs text-muted mt-2">
                La cuota de entrada se liquida con el organizador del torneo
              </p>
            )}

            {nextMatch ? (
              <Card className="p-5 border-gold/30">
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="w-5 h-5 text-gold" />
                  <h3 className="font-bold text-sm text-foreground">
                    {nextMatch.status === "PENDING" ? "Próximo partido" : "Partido actual"}
                  </h3>
                  <span className="text-[10px] text-muted">Ronda {nextMatch.roundNumber}</span>
                </div>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-lg font-bold">
                      {nextMatch.p1?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-bold text-center">{nextMatch.p1?.name || "---"}</span>
                  </div>
                  <div className="text-lg font-black text-gold">VS</div>
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-lg font-bold">
                      {nextMatch.p2?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-bold text-center">{nextMatch.p2?.name || "---"}</span>
                  </div>
                </div>
                {nextMatch.scheduledAt && (
                  <div className="mt-4">
                    <MatchCountdown scheduledAt={nextMatch.scheduledAt} status={nextMatch.status} large />
                  </div>
                )}
                <div className="mt-4 flex gap-2 justify-center">
                  <Link href={`/tournaments/${tournamentId}/bracket`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors">
                    <Swords className="w-4 h-4" /> Ver bracket completo
                  </Link>
                </div>
              </Card>
            ) : isTeamBased && !userTeamMember ? (
              <Card className="p-5 text-center">
                <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
                <p className="font-bold text-gold text-sm">Inscripción confirmada</p>
                <p className="text-xs text-muted mt-1 mb-4">Aún no formas parte de un equipo</p>
                <div className="flex gap-2 justify-center">
                  <Link href="/teams/create" className="px-4 py-2 min-h-[40px] inline-flex items-center bg-gold text-background font-bold rounded-xl text-sm">Crear equipo</Link>
                  <Link href="/free-agents?tab=teams" className="px-4 py-2 border border-gold/50 text-gold font-bold rounded-xl text-sm hover:bg-gold/10 transition-colors">Buscar equipo</Link>
                </div>
              </Card>
            ) : hasRounds ? (
              <Card className="p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="font-bold text-green-400 text-sm">Inscrito</p>
                <p className="text-xs text-muted mt-1 mb-4">El torneo ya comenzó</p>
                <Link href={`/tournaments/${tournamentId}/bracket`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-background font-bold rounded-xl text-sm">
                  <Swords className="w-4 h-4" /> Ver bracket
                </Link>
              </Card>
            ) : (
              <Card className="p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="font-bold text-green-400 text-sm">Inscrito en este torneo</p>
                <p className="text-xs text-muted mt-1">Inscripción confirmada por el organizador</p>
              </Card>
            )}
              </>
            )}
          </>
        )}

        {/* Closed */}
        {!isOpen && tournamentStatus !== "COMPLETED" && tournamentStatus !== "IN_PROGRESS" && (
          <Card className="p-4 text-center">
            <p className="text-muted text-sm">Las inscripciones están cerradas para este torneo</p>
          </Card>
        )}
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <RegisterModal
          tournamentId={tournamentId}
          onClose={() => { setShowRegisterModal(false); router.refresh(); }}
        />
      )}
    </>
  );
}
