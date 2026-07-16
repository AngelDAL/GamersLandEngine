"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Users, User, Loader2, Send, AlertCircle } from "lucide-react";

type Player = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

type Team = {
  id: string;
  name: string;
  captain: { id: string; username: string };
  _count: { members: number };
  members: {
    id: string;
    lane: string | null;
    user: {
      id: string;
      username: string;
      riotGameName: string | null;
      riotTagLine: string | null;
      riotIconId: number | null;
    };
  }[];
};

type Tab = "players" | "teams";

export default function FreeAgentsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>((searchParams?.tab === "teams" || searchParams?.tab === "players" ? searchParams.tab as Tab : "teams"));
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedTeamIds, setRequestedTeamIds] = useState<Set<string>>(new Set());
  const [sendingTeamId, setSendingTeamId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Fetch free agents
  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    setError(null);
    try {
      const res = await fetch("/api/free-agents");
      if (!res.ok) throw new Error("Error al cargar jugadores");
      const data = await res.json();
      setPlayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar jugadores");
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  // Fetch available teams
  const fetchTeams = useCallback(async () => {
    setLoadingTeams(true);
    setError(null);
    try {
      const res = await fetch("/api/teams?availableForUser=true");
      if (!res.ok) throw new Error("Error al cargar equipos");
      const data = await res.json();
      setTeams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar equipos");
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "players") {
      fetchPlayers();
    } else {
      fetchTeams();
    }
  }, [tab, fetchPlayers, fetchTeams]);

  // Send join request to a team
  const handleRequestJoin = async (teamId: string) => {
    setSendingTeamId(teamId);
    try {
      const res = await fetch(`/api/teams/${teamId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messages[teamId] || undefined }),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Error al enviar solicitud");
        return;
      }
      setRequestedTeamIds((prev) => new Set(prev).add(teamId));
    } catch {
      alert("Error al enviar solicitud");
    } finally {
      setSendingTeamId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Agentes Libres</h1>
      <p className="text-muted text-sm mb-6">
        {tab === "players"
          ? "Jugadores disponibles para ser reclutados en equipos"
          : "Equipos que aceptan solicitudes de unión"}
      </p>

      {/* Toggle */}
      <div className="flex gap-1 mb-8 bg-surface border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("teams")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "teams"
              ? "bg-gold text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Equipos disponibles
        </button>
        <button
          onClick={() => setTab("players")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "players"
              ? "bg-gold text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4" />
          Agentes Libres
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading state for current tab */}
      {(tab === "players" && loadingPlayers) || (tab === "teams" && loadingTeams) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : null}

      {/* Players tab */}
      {tab === "players" && !loadingPlayers && (
        <div className="grid gap-3 md:grid-cols-2">
          {players.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm">
                {p.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{p.username}</p>
                <p className="text-xs text-muted">Jugador</p>
              </div>
            </Card>
          ))}
          {players.length === 0 && (
            <p className="text-muted text-center col-span-2 py-8">
              No hay agentes libres disponibles
            </p>
          )}
        </div>
      )}

      {/* Teams tab */}
      {tab === "teams" && !loadingTeams && (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const alreadyRequested = requestedTeamIds.has(team.id);
            const isSending = sendingTeamId === team.id;
            const laneOrder = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
            const availableLanes = laneOrder.filter(
              (l) => !team.members.some((m) => m.lane === l)
            );
            const assignedMembers = laneOrder
              .map((l) => team.members.find((m) => m.lane === l))
              .filter((m): m is NonNullable<typeof m> => !!m);
            const unassignedMembers = team.members.filter(
              (m) => !m.lane
            );

            return (
              <Card key={team.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {team.name}
                    </h3>
                    <p className="text-xs text-muted">
                      Capitán: {team.captain.username}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted whitespace-nowrap">
                    {team._count.members}/5 <span className="text-muted">miembros</span>
                  </div>
                </div>

                {/* Team members by lane */}
                {assignedMembers.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Líneas asignadas</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {assignedMembers.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-background rounded-lg px-2 py-1.5 border border-border">
                          {m.user.riotIconId && m.user.riotIconId > 0 ? (
                            <img
                              src={`https://ddragon.leagueoflegends.com/cdn/15.6.1/img/profileicon/${m.user.riotIconId}.png`}
                              alt=""
                              className="w-5 h-5 rounded-full shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[8px] text-gold font-bold shrink-0">
                              {m.user.username[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium truncate leading-tight">
                              {m.user.riotGameName || m.user.username}
                            </p>
                            <p className="text-[8px] text-muted truncate leading-tight">
                              {m.lane === "TOP" ? "Top" :
                               m.lane === "JUNGLE" ? "Jungla" :
                               m.lane === "MID" ? "Mid" :
                               m.lane === "ADC" ? "ADC" : "Support"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unassigned members */}
                {unassignedMembers.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Sin línea asignada</p>
                    <div className="flex flex-wrap gap-1.5">
                      {unassignedMembers.map((m) => (
                        <span key={m.id} className="text-[10px] px-2 py-1 rounded-full bg-background border border-border text-muted">
                          {m.user.riotGameName || m.user.username}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open lanes */}
                {availableLanes.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Líneas disponibles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableLanes.map((l) => (
                        <span key={l} className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold">
                          {l === "TOP" ? "Top" :
                           l === "JUNGLE" ? "Jungla" :
                           l === "MID" ? "Mid" :
                           l === "ADC" ? "ADC" : "Support"} 🟢
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {team.members.length === 0 && (
                  <p className="text-[10px] text-muted mb-3">Equipo vacío — esperando miembros</p>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Mensaje opcional..."
                    value={messages[team.id] || ""}
                    onChange={(e) =>
                      setMessages((prev) => ({
                        ...prev,
                        [team.id]: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
                    disabled={alreadyRequested || isSending}
                  />
                  <button
                    onClick={() => handleRequestJoin(team.id)}
                    disabled={alreadyRequested || isSending}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      alreadyRequested
                        ? "bg-green-600/20 text-green-400 border border-green-500/30 cursor-default"
                        : "bg-gold hover:bg-gold-hover text-background disabled:opacity-50"
                    }`}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : alreadyRequested ? (
                      "✅ Solicitud enviada"
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Solicitar unirme
                      </>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
          {teams.length === 0 && (
            <p className="text-muted text-center col-span-2 py-8">
              No hay equipos disponibles para solicitar unión
            </p>
          )}
        </div>
      )}
    </div>
  );
}
