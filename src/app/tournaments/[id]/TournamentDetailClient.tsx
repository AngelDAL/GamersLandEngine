"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RegisterModal } from "./_components/RegisterModal";
import { MatchCountdown } from "@/components/notifications/MatchCountdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UserPlus, CheckCircle, LogIn, Swords, Users,
  ArrowRight, Calendar, Trophy, Loader2,
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

type Props = {
  tournamentId: string;
  tournamentStatus: string;
  tournamentName: string;
  eventDate: string;
  session: { id: string; name: string; role: string } | null;
  registration: any;
  teams: any[];
  freeAgents: any[];
  userTeamMember: any;
  isTeamBased: boolean;
  rounds: Round[];
  allParticipants: Participant[];
};

export function TournamentDetailClient({
  tournamentId, tournamentStatus, tournamentName, eventDate, session, registration,
  teams, freeAgents, userTeamMember, isTeamBased, rounds, allParticipants,
}: Props) {
  const router = useRouter();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

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
  const isPlayer = session?.role === "PLAYER";
  const isRegistered = !!registration;
  const hasRounds = rounds.length > 0;

  const resolveName = (id: string) => allParticipants.find((p) => p.id === id)?.name || id.slice(0, 8);

  // Find the user's next match (latest round first)
  const nextMatch = useMemo(() => {
    if (!session?.id) return null;
    const userId = session.id;
    let userTeamId: string | null = null;
    if (isTeamBased && userTeamMember) {
      userTeamId = userTeamMember.team.id;
    }
    // Iterate rounds in REVERSE — highest round where user appears = current match
    for (let ri = rounds.length - 1; ri >= 0; ri--) {
      const round = rounds[ri];
      for (const match of round.matches) {
        if (match.status === "COMPLETED") continue;
        const isParticipant = isTeamBased
          ? match.team1Id === userTeamId || match.team2Id === userTeamId
          : match.team1Id === userId || match.team2Id === userId;
        if (isParticipant) {
          const p1 = allParticipants.find((p) => p.id === match.team1Id) || null;
          const p2 = allParticipants.find((p) => p.id === match.team2Id) || null;
          return { ...match, roundNumber: round.roundNumber, p1, p2 };
        }
      }
    }
    return null;
  }, [rounds, session?.id, isTeamBased, userTeamMember, allParticipants]);

  const handleAutoRegister = async () => {
    setRegistrationLoading(true);
    try {
      await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      await fetch(`/api/tournaments/${tournamentId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.refresh();
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
                  {session ? (
                    <>
                      <p className="font-bold text-foreground">¿Quieres participar?</p>
                      <p className="text-xs text-muted mt-0.5">Regístrate directamente en este torneo</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-foreground">¿Quieres jugar?</p>
                      <p className="text-xs text-muted mt-0.5">Crea una cuenta y participa</p>
                    </>
                  )}
                </div>
              </div>
              {session ? (
                <Button onClick={handleAutoRegister} disabled={registrationLoading} size="lg" className="shrink-0 w-full sm:w-auto">
                  {registrationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  {registrationLoading ? "REGISTRANDO..." : "REGISTRARME AHORA"}
                </Button>
              ) : (
                <Button onClick={() => setShowRegisterModal(true)} size="lg" className="shrink-0 w-full sm:w-auto">
                  <UserPlus className="w-5 h-5" />
                  CREAR CUENTA
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Registered: show status */}
        {isRegistered && (
          <>
            {/* Check-in & payment status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Check-in */}
              {registration?.checkedInAt ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400">
                  ✅ Check-in a las {formatCheckinTime(registration.checkedInAt)}
                </span>
              ) : isEventDay ? (
                <button
                  onClick={handleCheckin}
                  disabled={checkinLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {checkinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "✅ Hacer check-in"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted/10 border border-border text-muted">
                  🎫 Check-in disponible el día del evento
                </span>
              )}

              {/* Payment badge (only show if paid) */}
              {registration?.paid && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400">
                  ✅ Cuota pagada
                </span>
              )}
            </div>

            {/* Payment info (when not paid) */}
            {!registration?.paid && (
              <p className="text-xs text-muted mt-2">
                💰 La cuota de entrada se paga en el local o a través de la pasarela de pago (próximamente)
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
                <p className="font-bold text-gold text-sm">Estás registrado</p>
                <p className="text-xs text-muted mt-1 mb-4">Aún no formas parte de un equipo</p>
                <div className="flex gap-2 justify-center">
                  <a href="/teams/create" className="px-4 py-2 bg-gold text-background font-bold rounded-xl text-sm">Crear equipo</a>
                  <Link href="/free-agents?tab=teams" className="px-4 py-2 border border-gold/50 text-gold font-bold rounded-xl text-sm hover:bg-gold/10 transition-colors">Buscar equipo</Link>
                </div>
              </Card>
            ) : hasRounds ? (
              <Card className="p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="font-bold text-green-400 text-sm">Estás registrado</p>
                <p className="text-xs text-muted mt-1 mb-4">El torneo ya comenzó</p>
                <Link href={`/tournaments/${tournamentId}/bracket`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-background font-bold rounded-xl text-sm">
                  <Swords className="w-4 h-4" /> Ver bracket
                </Link>
              </Card>
            ) : (
              <Card className="p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="font-bold text-green-400 text-sm">Estás registrado en este torneo</p>
                <p className="text-xs text-muted mt-1">Espera a que se asignen los enfrentamientos</p>
              </Card>
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
