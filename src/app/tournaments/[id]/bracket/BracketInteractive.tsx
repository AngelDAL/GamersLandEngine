"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchChat } from "@/components/chat/MatchChat";
import {
  Swords, ArrowLeft, Shuffle, GripVertical,
  ArrowUpDown, Save, Play, Check,
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
};

export function BracketInteractive({
  tournament, canEdit, userId, userTeamIds,
  tournamentName, tournamentId, registeredTeams,
  isIndividual, playerNames,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [teamOrder, setTeamOrder] = useState(registeredTeams);
  const [statusMsg, setStatusMsg] = useState("");

  const rounds = tournament.rounds || [];
  const hasRounds = rounds.length > 0;

  const teamName = (match: any, side: "team1" | "team2"): string => {
    const team = match[side];
    if (team?.name) return team.name;
    const id = match[`${side}Id`];
    if (isIndividual && id && playerNames?.[id]) return playerNames[id];
    return "---";
  };

  const moveTeam = (index: number, direction: "up" | "down") => {
    const newOrder = [...teamOrder];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setTeamOrder(newOrder);
  };

  const generateBracket = async () => {
    setLoading("generate");
    setStatusMsg("");

    // Ensure teams are registered in the correct order
    // First, add any teams that aren't already in the tournament
    for (const team of teamOrder) {
      await fetch(`/api/tournaments/${tournamentId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      }).catch(() => {});
    }

    const res = await fetch(`/api/tournaments/${tournamentId}/rounds`, {
      method: "POST",
    });

    if (res.ok) {
      setStatusMsg("Bracket generado exitosamente");
    } else {
      const data = await res.json();
      setStatusMsg(data.error || "Error al generar bracket");
    }
    setLoading(null);
    router.refresh();
  };

  return (
    <div className="max-w-full mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <Link
            href={`/tournaments/${tournamentId}`}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
          <h1 className="text-xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <Swords className="w-5 h-5 sm:w-7 sm:h-7 text-gold" />
            {tournamentName}
          </h1>
        </div>

        {canEdit && !hasRounds && (
          <Button onClick={generateBracket} disabled={loading === "generate" || teamOrder.length < 2} className="w-full sm:w-auto">
            {loading === "generate" ? "Generando..." : "Generar Bracket"}
          </Button>
        )}
      </div>

      {statusMsg && (
        <div className="mb-4 px-4 py-2 bg-gold/10 border border-gold/30 rounded-xl text-sm text-gold flex items-center gap-2">
          <Check className="w-4 h-4" />
          {statusMsg}
        </div>
      )}

      {/* ─── Bracket Setup (manual) ─── */}
      {canEdit && !hasRounds && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-bold text-gold flex items-center gap-2 mb-4">
            <Shuffle className="w-5 h-5" />
            Organizar bracket
          </h2>
          <p className="text-xs sm:text-sm text-muted mb-4">
            Ordena los equipos en la posición que quieras en el bracket. El orden define los enfrentamientos.
          </p>

          {teamOrder.length < 2 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs sm:text-sm text-yellow-400">
              Se necesitan al menos 2 equipos registrados. Agrega equipos desde la pestaña "Participantes" en la gestión del torneo.
            </div>
          ) : (
            <div className="space-y-2">
              {teamOrder.map((team, i) => (
                <div
                  key={team.id}
                  className="flex items-center gap-2 sm:gap-3 p-3 bg-background border border-border rounded-xl"
                >
                  <span className="text-xs font-bold text-muted w-5 text-center shrink-0">{i + 1}</span>
                  <GripVertical className="w-4 h-4 text-muted shrink-0" />
                  <span className="flex-1 text-sm font-medium truncate">{team.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => moveTeam(i, "up")}
                      disabled={i === 0}
                      className="p-1.5 rounded-lg hover:bg-gold/10 text-muted hover:text-gold disabled:opacity-30 transition-colors"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 rotate-90" />
                    </button>
                    <button
                      onClick={() => moveTeam(i, "down")}
                      disabled={i === teamOrder.length - 1}
                      className="p-1.5 rounded-lg hover:bg-gold/10 text-muted hover:text-gold disabled:opacity-30 transition-colors"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ─── Bracket View ─── */}
      {hasRounds ? (
        <div className="overflow-x-auto pb-4 -mx-3 sm:mx-0">
          <div className="flex gap-3 sm:gap-6 px-3 sm:px-0 min-w-[600px] sm:min-w-0">
            {rounds.map((round: any) => (
              <div key={round.id} className="flex flex-col gap-3 min-w-[200px] sm:min-w-[240px] flex-1">
                <h3 className="text-xs sm:text-sm font-black text-gold text-center mb-1 uppercase tracking-widest">
                  Ronda {round.roundNumber}
                </h3>
                {round.matches.map((match: any) => {
                  const isParticipant = userId && (
                    userTeamIds.includes(match.team1?.id) ||
                    userTeamIds.includes(match.team2?.id)
                  );
                  const isBye = !match.team1 || !match.team2;

                  return (
                    <Card key={match.id} className="p-3 sm:p-4 min-w-0">
                      {isBye ? (
                        <div className="text-center text-muted text-xs sm:text-sm py-3">
                          <p className="font-bold">BYE</p>
                          <p className="text-[10px]">{teamName(match, "team1") || teamName(match, "team2") || "---"} avanza automáticamente</p>
                        </div>
                      ) : (
                        <>
                          <div className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-between gap-2 ${
                            match.winnerId === match.team1?.id || match.winnerId === match.team1Id
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-background border border-border"
                          }`}>
                            <span className="truncate">{teamName(match, "team1")}</span>
                            {match.score1 !== null && (
                              <span className="font-black shrink-0">{match.score1}</span>
                            )}
                          </div>
                          <div className="text-[10px] sm:text-xs text-center text-muted py-1 font-bold">VS</div>
                          <div className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-between gap-2 ${
                            match.winnerId === match.team2?.id || match.winnerId === match.team2Id
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-background border border-border"
                          }`}>
                            <span className="truncate">{teamName(match, "team2")}</span>
                            {match.score2 !== null && (
                              <span className="font-black shrink-0">{match.score2}</span>
                            )}
                          </div>

                          {match.status === "IN_PROGRESS" && isParticipant && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <MatchChat
                                matchId={match.id}
                                userId={userId!}
                                team1Name={teamName(match, "team1")}
                                team2Name={teamName(match, "team2")}
                                isParticipant={true}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : canEdit ? (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <Swords className="w-10 h-10 sm:w-12 sm:h-12 text-muted mx-auto mb-3 opacity-30" />
          <p className="text-muted font-medium text-sm sm:text-base">Organiza los equipos arriba y genera el bracket</p>
          <p className="text-xs text-muted mt-1">Usa las flechas para ordenar los enfrentamientos</p>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <Swords className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
          <p className="text-muted font-medium">El bracket aún no se ha generado</p>
        </div>
      )}
    </div>
  );
}
