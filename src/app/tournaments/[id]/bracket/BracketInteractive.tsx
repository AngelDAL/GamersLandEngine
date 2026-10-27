"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BracketSlot } from "@/components/tournament/BracketSlot";
import { ParticipantPool } from "@/components/tournament/ParticipantPool";
import { MatchChat } from "@/components/chat/MatchChat";
import { MatchCountdown } from "@/components/notifications/MatchCountdown";
import { RiotMatchCode } from "./RiotMatchCode";
import {
  Swords, ArrowLeft, Check, Loader2,
  Trophy, Medal, XCircle, Clock, Calendar,
} from "lucide-react";
import Link from "next/link";

type Props = {
  tournament: any;
  canEdit: boolean;
  userId?: string;
  userTeamIds: string[];
  tournamentName: string;
  tournamentId: string;
  registeredTeams: { id: string; name: string; captainId: string }[];
  isIndividual?: boolean;
  playerNames?: Record<string, string>;
  individualPlayers?: { id: string; name: string }[];
  maxSlots?: number;
};

function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  return 1 << (32 - Math.clz32(n - 1));
}

function formatLocalDatetime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function BracketInteractive({
  tournament, canEdit, userId, userTeamIds,
  tournamentName, tournamentId, registeredTeams,
  isIndividual, playerNames, individualPlayers, maxSlots,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editScores, setEditScores] = useState<{ s1: string; s2: string }>({ s1: "", s2: "" });
  const [isEditingSchedule, setIsEditingSchedule] = useState<string | null>(null);
  const [editScheduleDate, setEditScheduleDate] = useState("");

  // Confetti: only render on client (Math.random() causes SSR mismatch)
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => { setShowConfetti(true); }, []);

  // Auto-clear status message after 5s
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(""), 5000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const confirmRef = useRef<HTMLDialogElement>(null);
  const [confirmData, setConfirmData] = useState<{
    matchId: string; roundId: string; t1: string; t2: string; s1: number; s2: number; winner: string;
  } | null>(null);

  const rounds = tournament.rounds || [];
  const hasRounds = rounds.length > 0;

  const allParticipants = useMemo(() => {
    if (isIndividual && individualPlayers) return individualPlayers;
    return registeredTeams.map((t) => ({ id: t.id, name: t.name }));
  }, [isIndividual, individualPlayers, registeredTeams]);

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.team1Id) ids.add(match.team1Id);
        if (match.team2Id) ids.add(match.team2Id);
      }
    }
    return ids;
  }, [rounds]);

  const slotLabels = useMemo(() => {
    const labels: { matchId: string; label: string }[] = [];
    for (const round of rounds) {
      for (const match of round.matches) {
        const rNum = round.roundNumber;
        const pos = match.bracketPosition ?? 0;
        labels.push({ matchId: match.id, label: `R${rNum}-M${pos + 1} (A)` });
        labels.push({ matchId: match.id, label: `R${rNum}-M${pos + 1} (B)` });
      }
    }
    return labels;
  }, [rounds]);

  const teamName = (match: any, side: "team1" | "team2"): string => {
    const id = match[`${side}Id`];
    if (!id) return "---";
    if (isIndividual && playerNames?.[id]) return playerNames[id];
    const found = allParticipants.find((p) => p.id === id);
    if (found?.name) return found.name;
    return id.slice(0, 8);
  };

  // ── Find the user's next match (latest round first) ──
  const userNextMatch = useMemo(() => {
    if (!userId || rounds.length === 0) return null;
    // Iterate rounds in REVERSE — the highest round where the user appears is their current match
    for (let ri = rounds.length - 1; ri >= 0; ri--) {
      const round = rounds[ri];
      for (const match of round.matches) {
        if (match.status === "COMPLETED") continue;
        const isInMatch = isTeamBased()
          ? userTeamIds.includes(match.team1Id) || userTeamIds.includes(match.team2Id)
          : match.team1Id === userId || match.team2Id === userId;
        if (isInMatch) {
          const opponent = isTeamBased()
            ? (userTeamIds.includes(match.team1Id) ? teamName(match, "team2") : teamName(match, "team1"))
            : (match.team1Id === userId ? teamName(match, "team2") : teamName(match, "team1"));
          const myTeam = isTeamBased()
            ? (userTeamIds.includes(match.team1Id) ? teamName(match, "team1") : teamName(match, "team2"))
            : teamName(match, match.team1Id === userId ? "team1" : "team2");
          return {
            match,
            roundNumber: round.roundNumber,
            myTeam,
            opponent,
            scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : null,
          };
        }
      }
    }
    return null;
  }, [rounds, userId, userTeamIds]);

  // ── Check if user is in a specific match ──
  const isUserInMatch = (match: any): boolean => {
    if (!userId) return false;
    if (isTeamBased()) return userTeamIds.includes(match.team1Id) || userTeamIds.includes(match.team2Id);
    return match.team1Id === userId || match.team2Id === userId;
  };

  function isTeamBased(): boolean {
    return tournament.isTeamBased !== false;
  }

  // Init bracket structure
  const initBracket = async () => {
    setLoading("init");
    setStatusMsg("");
    const count = allParticipants.length;
    if (count < 2) {
      setStatusMsg("Se necesitan al menos 2 participantes");
      setLoading(null);
      return;
    }
    const numSlots = nextPowerOf2(count);
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numSlots }),
    });
    if (res.ok) {
      setStatusMsg("Bracket creado. Arrastra los participantes a las posiciones.");
    } else {
      const data = await res.json();
      setStatusMsg(data.error || "Error al crear bracket");
    }
    setLoading(null);
    router.refresh();
  };

  const assignToSlot = async (matchId: string, slot: "team1" | "team2", participantId: string) => {
    await fetch(`/api/tournaments/${tournamentId}/bracket/assign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, slot, participantId }),
    });
    router.refresh();
  };

  const removeFromSlot = async (matchId: string, slot: "team1" | "team2") => {
    await fetch(`/api/tournaments/${tournamentId}/bracket/assign`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, slot }),
    });
    router.refresh();
  };

  const handlePoolAssign = (participantId: string, slotKey: string) => {
    const [matchId, side] = slotKey.split(":");
    if (matchId && side) assignToSlot(matchId, side as "team1" | "team2", participantId);
  };

  const saveSchedule = async (matchId: string, roundId: string) => {
    if (!editScheduleDate) return;
    await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: new Date(editScheduleDate).toISOString() }),
    });
    setIsEditingSchedule(null);
    router.refresh();
  };

  const openConfirmDialog = (matchId: string, roundId: string) => {
    const sc1 = parseInt(editScores.s1) || 0;
    const sc2 = parseInt(editScores.s2) || 0;
    if (sc1 === sc2) {
      setStatusMsg("No puede haber empate. Define un ganador.");
      return;
    }
    const match = rounds.find((r: any) => r.id === roundId)?.matches.find((m: any) => m.id === matchId);
    const t1 = match ? teamName(match, "team1") : "???";
    const t2 = match ? teamName(match, "team2") : "???";
    const winner = sc1 > sc2 ? t1 : t2;
    setConfirmData({ matchId, roundId, t1, t2, s1: sc1, s2: sc2, winner });
    confirmRef.current?.showModal();
  };

  // Quick-declare: set winner with default 1-0 score
  const quickDeclareWinner = (matchId: string, roundId: string, winnerSlot: "team1" | "team2") => {
    const match = rounds.find((r: any) => r.id === roundId)?.matches.find((m: any) => m.id === matchId);
    if (!match) return;
    const t1 = teamName(match, "team1");
    const t2 = teamName(match, "team2");
    const winner = winnerSlot === "team1" ? t1 : t2;
    const s1 = winnerSlot === "team1" ? 1 : 0;
    const s2 = winnerSlot === "team2" ? 1 : 0;
    setConfirmData({ matchId, roundId, t1, t2, s1, s2, winner });
    confirmRef.current?.showModal();
  };

  const executeUpdateResult = async () => {
    if (!confirmData) return;
    const { matchId, roundId, s1, s2 } = confirmData;
    setLoading(matchId);
    setConfirmData(null);
    const match = rounds.find((r: any) => r.id === roundId)?.matches.find((m: any) => m.id === matchId);
    const winnerId = s1 > s2 ? match?.team1Id : s2 > s1 ? match?.team2Id : null;

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score1: s1, score2: s2, winnerId, status: "COMPLETED" }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMsg(err.error || "Error al guardar resultado");
      } else {
        setStatusMsg("Resultado guardado. El ganador avanza a la siguiente ronda.");
      }
    } catch {
      setStatusMsg("Error de conexión al guardar el resultado");
    }
    setLoading(null);
    setEditingMatch(null);
    router.refresh();
  };

  return (
    <div className="max-w-full mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* ── CHAMPION CELEBRATION ── */}
      {(() => {
        const lastRound = rounds[rounds.length - 1];
        const finalMatch = lastRound?.matches?.[0];
        if (!finalMatch || finalMatch.status !== "COMPLETED") return null;
        const champSide = finalMatch.winnerId
          ? (finalMatch.winnerId === finalMatch.team1Id ? "team1" as const : "team2" as const)
          : (finalMatch.score1 ?? 0) > (finalMatch.score2 ?? 0) ? "team1" as const
          : (finalMatch.score2 ?? 0) > (finalMatch.score1 ?? 0) ? "team2" as const
          : null;
        if (!champSide) return null;
        const champName = teamName(finalMatch, champSide);
        const colors = ["#C8AA6E", "#00B853", "#E84057", "#0397AB", "#7B8FA1", "#FFD700", "#FF69B4", "#00CED1"];
        return (
          <>
            {/* Confetti (client-only to avoid hydration mismatch) */}
            {showConfetti && Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className="confetti-piece" style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: colors[i % colors.length],
                animationDuration: `${2 + Math.random() * 3}s`,
                animationDelay: `${Math.random() * 0.5}s`,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }} />
            ))}
            {/* Champion banner */}
            <div className="mb-6 p-6 sm:p-8 bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-2 border-gold rounded-2xl text-center">
              <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-gold mx-auto mb-3" />
              <p className="text-xs text-gold uppercase tracking-widest font-bold mb-2">¡Campeón del torneo!</p>
              <h2 className="text-2xl sm:text-4xl font-black text-gold">{champName}</h2>
              <p className="text-sm text-muted mt-2">{tournamentName}</p>
            </div>
          </>
        );
      })()}

      {/* Banner */}
      {tournament.imageUrl && (
        <div className="relative h-20 rounded-xl overflow-hidden mb-4">
          <img src={tournament.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <Link href={`/tournaments/${tournamentId}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
          <h1 className="text-xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <Swords className="w-5 h-5 sm:w-7 sm:h-7 text-gold" />
            {tournamentName}
          </h1>
        </div>
        {canEdit && !hasRounds && (
          <Button onClick={initBracket} disabled={loading === "init" || allParticipants.length < 2} className="w-full sm:w-auto">
            {loading === "init" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === "init" ? "Creando..." : "Inicializar Bracket"}
          </Button>
        )}
      </div>

      {statusMsg && (
        <div className="mb-4 px-4 py-2 bg-gold/10 border border-gold/30 rounded-xl text-sm text-gold flex items-center gap-2">
          <Check className="w-4 h-4" />
          {statusMsg}
        </div>
      )}

      {/* ── USER NEXT MATCH HIGHLIGHT ── */}
      {userNextMatch && (
        <div className="mb-6 p-4 sm:p-6 bg-gold/5 border-2 border-gold/40 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                <Swords className="w-3.5 h-3.5" />
                Tu próximo partido · Ronda {userNextMatch.roundNumber}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
                <span className="text-lg sm:text-2xl font-black text-foreground">{userNextMatch.myTeam}</span>
                <span className="text-gold font-black text-xl sm:text-3xl">VS</span>
                <span className="text-lg sm:text-2xl font-black text-muted">{userNextMatch.opponent}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              {userNextMatch.scheduledAt ? (
                <>
                  <div className="flex items-center gap-2 text-muted text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    {userNextMatch.scheduledAt.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <MatchCountdown scheduledAt={userNextMatch.scheduledAt.toISOString()} status={userNextMatch.match.status} large />
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Horario por definir</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasRounds && canEdit && (
        <Card className="p-6 text-center">
          <Swords className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
          <p className="text-muted font-medium">
            {allParticipants.length < 2
              ? "Se necesitan al menos 2 participantes para crear el bracket"
              : "Presiona 'Inicializar Bracket' para crear la estructura del torneo"}
          </p>
          <p className="text-xs text-muted mt-1">
            {allParticipants.length} participante{allParticipants.length !== 1 ? "s" : ""} registrado{allParticipants.length !== 1 ? "s" : ""}
          </p>
        </Card>
      )}

      {/* Bracket Builder */}
      {hasRounds && (
        <div className="relative rounded-2xl overflow-hidden border border-border">
          {/* Tournament image background (subtle) */}
          {tournament.imageUrl && (
            <div className="absolute inset-0 pointer-events-none z-0">
              <img src={tournament.imageUrl} alt="" className="w-full h-full object-cover opacity-30"
                style={{ maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0) 100%)", WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0) 100%)" }} />
            </div>
          )}
          <div className={`relative z-10 grid gap-6 p-4 sm:p-6 ${canEdit ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-1"}`}>
          {canEdit && (
            <div className="order-2 lg:order-1">
              <ParticipantPool
                participants={allParticipants}
                assignedIds={assignedIds}
                onAssignToSlot={handlePoolAssign}
                slots={slotLabels}
              />
            </div>
          )}

          <div className="order-1 lg:order-2 overflow-x-auto pb-4">
            <div className="flex gap-5 sm:gap-8 min-w-max">
              {rounds.map((round: any) => (
                <div key={round.id} className="flex flex-col gap-3 min-w-[230px] sm:min-w-[280px]">
                  <h3 className="text-xs font-black text-gold text-center mb-1 uppercase tracking-widest">
                    Ronda {round.roundNumber}
                    {round.roundNumber === rounds.length && (
                      <Trophy className="w-3.5 h-3.5 inline ml-1" />
                    )}
                  </h3>

                  {round.matches.map((match: any) => {
                    const mId = match.id;
                    const isEditing = editingMatch === mId;
                    const p1 = allParticipants.find((p) => p.id === match.team1Id) || null;
                    const p2 = allParticipants.find((p) => p.id === match.team2Id) || null;
                    const hasBoth = p1 && p2;
                    const isCompleted = match.status === "COMPLETED";
                    const userIsInMatch = isUserInMatch(match);
                    // Determine winner: use winnerId for team tournaments, scores for individual
                    const winnerSide: "team1" | "team2" | null = match.winnerId
                      ? (match.winnerId === match.team1Id ? "team1" : "team2")
                      : (match.score1 ?? 0) > (match.score2 ?? 0)
                        ? "team1"
                        : (match.score2 ?? 0) > (match.score1 ?? 0)
                          ? "team2"
                          : null;
                    const winnerName = isCompleted && winnerSide
                      ? teamName(match, winnerSide)
                      : null;
                    const loserName = isCompleted && winnerSide
                      ? teamName(match, winnerSide === "team1" ? "team2" : "team1")
                      : null;

                    return (
                      <Card
                        key={mId}
                        className={`p-3 sm:p-4 min-w-0 transition-all ${
                          userIsInMatch && !isCompleted
                            ? "ring-2 ring-gold/60 shadow-lg shadow-gold/10 bg-gold/[0.03]"
                            : userIsInMatch && isCompleted
                              ? "ring-1 ring-gold/20"
                              : ""
                        }`}
                      >
                        {/* Slot A */}
                        <BracketSlot
                          matchId={mId}
                          slot="team1"
                          participant={p1}
                          isWinner={winnerSide === "team1"}
                          isUser={isTeamBased() ? userTeamIds.includes(match.team1Id) : match.team1Id === userId}
                          onAssign={(pid) => assignToSlot(mId, "team1", pid)}
                          onRemove={() => removeFromSlot(mId, "team1")}
                          availableParticipants={allParticipants.filter(
                            (p) => !assignedIds.has(p.id) || p.id === match.team1Id
                          )}
                        />

                        {/* VS / Score */}
                        <div className={`text-center py-1.5 font-bold ${
                          isCompleted ? "text-sm text-green-400" : "text-[10px] text-muted"
                        }`}>
                          {!hasBoth ? "BYE →" : isCompleted ? `${match.score1 ?? 0} - ${match.score2 ?? 0}` : "VS"}
                        </div>

                        {/* Slot B */}
                        <BracketSlot
                          matchId={mId}
                          slot="team2"
                          participant={p2}
                          isWinner={winnerSide === "team2"}
                          isUser={isTeamBased() ? userTeamIds.includes(match.team2Id) : match.team2Id === userId}
                          onAssign={(pid) => assignToSlot(mId, "team2", pid)}
                          onRemove={() => removeFromSlot(mId, "team2")}
                          availableParticipants={allParticipants.filter(
                            (p) => !assignedIds.has(p.id) || p.id === match.team2Id
                          )}
                        />

                        {/* Quick-declare winner buttons (admin, both participants, not completed) */}
                        {canEdit && hasBoth && !isCompleted && (
                          <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-border">
                            <button
                              onClick={() => quickDeclareWinner(mId, round.id, "team1")}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/10 transition-colors"
                              title={`Declarar ganador: ${p1?.name}`}
                            >
                              👑 {p1?.name?.slice(0, 12)}{(p1?.name?.length ?? 0) > 12 ? "…" : ""}
                            </button>
                            <span className="text-[10px] text-muted">VS</span>
                            <button
                              onClick={() => quickDeclareWinner(mId, round.id, "team2")}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/10 transition-colors"
                              title={`Declarar ganador: ${p2?.name}`}
                            >
                              👑 {p2?.name?.slice(0, 12)}{(p2?.name?.length ?? 0) > 12 ? "…" : ""}
                            </button>
                          </div>
                        )}

                        {/* COMPLETED: winner/loser display */}
                        {isCompleted && winnerName && (
                          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                            <div className="flex items-center justify-center gap-2 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <Medal className="w-5 h-5 text-green-400" />
                              <span className="text-green-400 font-bold text-sm">{winnerName}</span>
                              <span className="text-green-400 text-xs font-bold tracking-wider uppercase">Ganador</span>
                            </div>
                            {loserName && (
                              <div className="flex items-center justify-center gap-1.5 py-1 bg-red-500/5 border border-red-500/20 rounded-lg">
                                <XCircle className="w-3.5 h-3.5 text-red-400/70" />
                                <span className="text-red-400/70 text-xs">{loserName}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Riot Tournament Code (LoL only, when both teams present and not completed) */}
                        {hasBoth && !isCompleted && (tournament.game ?? "").toUpperCase() === "LEAGUE_OF_LEGENDS" && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <RiotMatchCode
                              matchId={mId}
                              userIsInMatch={userIsInMatch}
                              canEdit={canEdit}
                            />
                          </div>
                        )}

                        {/* Scores & Actions (editable, not completed) */}
                        {canEdit && hasBoth && !isCompleted && (
                          <div className="mt-2 pt-2 border-t border-border">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input type="number" placeholder="Score A" value={editScores.s1}
                                    onChange={(e) => setEditScores((s) => ({ ...s, s1: e.target.value }))}
                                    className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-center" />
                                  <span className="text-xs text-muted self-center">vs</span>
                                  <input type="number" placeholder="Score B" value={editScores.s2}
                                    onChange={(e) => setEditScores((s) => ({ ...s, s2: e.target.value }))}
                                    className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-center" />
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={() => openConfirmDialog(mId, round.id)} disabled={loading === mId} className="flex-1 text-[10px]">
                                    {loading === mId ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    {loading === mId ? "..." : "Completar"}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingMatch(null)} className="text-[10px]">Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingMatch(mId); setEditScores({ s1: String(match.score1 ?? ""), s2: String(match.score2 ?? "") }); }}
                                className="w-full py-1.5 text-[10px] text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors">
                                Ingresar resultado
                              </button>
                            )}
                          </div>
                        )}

                        {/* Schedule - admin only */}
                        {canEdit && (
                          <div className="mt-2 pt-1">
                            {isEditingSchedule === mId ? (
                              <div className="flex gap-1">
                                <input type="datetime-local" value={editScheduleDate}
                                  onChange={(e) => setEditScheduleDate(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-background border border-border rounded text-[10px]" />
                                <button onClick={() => saveSchedule(mId, round.id)}
                                  className="px-2 py-1 bg-gold text-background rounded text-[9px] font-bold">OK</button>
                                <button onClick={() => setIsEditingSchedule(null)}
                                  className="px-2 py-1 border border-border rounded text-[9px]">X</button>
                              </div>
                            ) : (
                              (() => {
                                const isOverdue = match.scheduledAt && new Date(match.scheduledAt).getTime() < Date.now() && match.status === "PENDING";
                                return isOverdue ? (
                                  <button onClick={() => {
                                    setIsEditingSchedule(mId);
                                    setEditScheduleDate(formatLocalDatetime());
                                  }}
                                    className="w-full py-1.5 text-[11px] text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5">
                                    ⏰ Reprogramar partido atrasado
                                  </button>
                                ) : (
                                  <button onClick={() => {
                                    setIsEditingSchedule(mId);
                                    setEditScheduleDate(match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : formatLocalDatetime());
                                  }}
                                    className="text-[9px] text-gold hover:underline flex items-center gap-1">
                                    🕐 {match.scheduledAt ? "Cambiar horario" : "Programar"}
                                  </button>
                                );
                              })()
                            )}
                          </div>
                        )}

                        {/* Match countdown for players */}
                        {match.scheduledAt && match.status !== "COMPLETED" && (
                          <div className="mt-1">
                            <MatchCountdown scheduledAt={match.scheduledAt} status={match.status} />
                          </div>
                        )}

                        {/* Match Chat */}
                        {match.status === "IN_PROGRESS" && userId && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <MatchChat
                              matchId={mId} userId={userId}
                              team1Name={teamName(match, "team1")} team2Name={teamName(match, "team2")}
                              isParticipant={true}
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOG ── */}
      <dialog ref={confirmRef}
        className="rounded-2xl border border-border bg-surface text-foreground p-0 shadow-2xl backdrop:bg-black/60 max-w-sm w-full"
        onClose={() => setConfirmData(null)}>
        {confirmData && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Confirmar resultado</h2>
                <p className="text-xs text-muted">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="bg-background border border-border rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className={confirmData.s1 > confirmData.s2 ? "text-green-400 font-bold" : "text-muted"}>{confirmData.t1}</span>
                <span className="text-xs text-muted font-mono">{confirmData.s1}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={confirmData.s2 > confirmData.s1 ? "text-green-400 font-bold" : "text-muted"}>{confirmData.t2}</span>
                <span className="text-xs text-muted font-mono">{confirmData.s2}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <Medal className="w-4 h-4 text-gold" />
                <span className="text-sm">Ganador: <strong className="text-gold">{confirmData.winner}</strong></span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { confirmRef.current?.close(); executeUpdateResult(); }} className="flex-1 bg-green-600 hover:bg-green-700">Confirmar</Button>
              <Button variant="outline" onClick={() => { confirmRef.current?.close(); setConfirmData(null); }} className="flex-1">Cancelar</Button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
