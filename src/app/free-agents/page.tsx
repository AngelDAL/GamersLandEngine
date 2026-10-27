"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  Users, User, Loader2, Send, AlertCircle, UserPlus, RefreshCw, ExternalLink,
} from "lucide-react";

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

type MyTeam = { id: string; name: string; captainId?: string };

type MyTeamApi = {
  id: string;
  name: string;
  captain?: { id: string; username: string };
  members?: { userId: string; status: string }[];
};

type Tab = "players" | "teams";

const laneLabels: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungla",
  MID: "Mid",
  ADC: "ADC",
  SUPPORT: "Support",
};

export default function FreeAgentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("teams");
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
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

  // Mis equipos (para el CTA de invitar desde la pestaña de jugadores)
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: MyTeamApi[]) => {
        if (cancelled) return;
        const mine = (Array.isArray(data) ? data : [])
          .filter((t) =>
            t.members?.some(
              (m) => m.userId === session.user.id && m.status === "ACTIVE",
            ),
          )
          .map((t) => ({ id: t.id, name: t.name, captainId: t.captain?.id }));
        setMyTeams(mine);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session]);

  // Fetch free agents
  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    setError(null);
    try {
      const res = await fetch("/api/free-agents");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch {
      setError("No pudimos cargar los jugadores disponibles.");
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
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch {
      setError("No pudimos cargar los equipos disponibles.");
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout(0): el fetch arranca fuera del cuerpo síncrono del efecto
    const id = setTimeout(() => {
      if (tab === "players") {
        fetchPlayers();
      } else {
        fetchTeams();
      }
    }, 0);
    return () => clearTimeout(id);
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
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "No se pudo enviar la solicitud.");
        return;
      }
      toast.success("Solicitud enviada. El capitán la revisará pronto.");
      setRequestedTeamIds((prev) => new Set(prev).add(teamId));
    } catch {
      toast.error("No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSendingTeamId(null);
    }
  };

  const retry = () => {
    if (tab === "players") fetchPlayers();
    else fetchTeams();
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

  const myCaptainTeam = myTeams.find((t) => t.captainId === session?.user?.id) || myTeams[0];
  const laneOrder = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Agentes Libres</h1>
      <p className="text-muted text-sm mb-6">
        {tab === "players"
          ? "Jugadores sin equipo, listos para ser reclutados"
          : "Equipos que están buscando miembros"}
      </p>

      {/* Toggle */}
      <div className="flex gap-1 mb-8 bg-surface border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("teams")}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-10 rounded-lg text-sm font-medium transition-colors ${
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
          className={`flex items-center gap-2 px-4 py-2.5 min-h-10 rounded-lg text-sm font-medium transition-colors ${
            tab === "players"
              ? "bg-gold text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4" />
          Jugadores libres
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 text-xs font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state for current tab */}
      {(tab === "players" && loadingPlayers) || (tab === "teams" && loadingTeams) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : null}

      {/* Players tab */}
      {tab === "players" && !loadingPlayers && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {players.map((p) => (
            <Link key={p.id} href={`/players/${p.id}`} className="group">
              <Card className="flex items-center gap-3 p-4 hover:border-gold/50 transition-colors h-full">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm">
                    {p.username[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium group-hover:text-gold transition-colors truncate">{p.username}</p>
                  <p className="text-xs text-muted">Jugador sin equipo</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted shrink-0" />
              </Card>
            </Link>
          ))}
          {players.length === 0 && (
            <p className="text-muted text-center col-span-2 py-8">
              No hay jugadores sin equipo en este momento
            </p>
          )}
        </div>
      )}

      {/* CTA invitar (sobre la lista de jugadores) */}
      {tab === "players" && !loadingPlayers && !error && players.length > 0 && (
        <div className="mt-6 p-4 bg-gold/5 border border-gold/20 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
          <UserPlus className="w-5 h-5 text-gold shrink-0" />
          <p className="text-sm text-muted flex-1">
            {myCaptainTeam
              ? `¿Quieres reclutar a alguien? Entra a tu equipo "${myCaptainTeam.name}" para invitarlo por nombre o código QR.`
              : "¿Quieres reclutar jugadores? Crea tu equipo y ábrelo a solicitudes."}
          </p>
          <Link
            href={myCaptainTeam ? `/teams/${myCaptainTeam.id}` : "/teams/create"}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            {myCaptainTeam ? "Invitar a mi equipo" : "Crear equipo"}
          </Link>
        </div>
      )}

      {/* Teams tab */}
      {tab === "teams" && !loadingTeams && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const alreadyRequested = requestedTeamIds.has(team.id);
            const isSending = sendingTeamId === team.id;
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
                              {laneLabels[m.lane || ""] || m.lane}
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
                          {laneLabels[l] || l}
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
                    className="flex-1 px-3 py-2.5 min-h-10 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
                    disabled={alreadyRequested || isSending}
                  />
                  <button
                    onClick={() => handleRequestJoin(team.id)}
                    disabled={alreadyRequested || isSending}
                    className={`px-4 py-2.5 min-h-10 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      alreadyRequested
                        ? "bg-green-600/20 text-green-400 border border-green-500/30 cursor-default"
                        : "bg-gold hover:bg-gold-hover text-background disabled:opacity-50"
                    }`}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : alreadyRequested ? (
                      "Solicitud enviada"
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
              No hay equipos buscando miembros ahora mismo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
