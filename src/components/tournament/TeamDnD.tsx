"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  Users, Shield, Trash2, Crown,
  X, Check, Search, Plus, Loader2,
} from "lucide-react";

type Player = { id: string; username: string };
type TeamData = {
  id: string;
  name: string;
  captainId: string;
  captain: { id: string; username: string };
  members: { id: string; userId: string; user: { id: string; username: string }; status: string }[];
};

type Props = {
  tournamentId: string;
  tournamentName: string;
  teams: TeamData[];
  freeAgents: Player[];
  isIndividual: boolean;
  tournamentTeams: { teamId: string }[];
  allPlayers: Player[];
  teamSize: number;
};

type TeamMemberData = { id: string; userId: string; user: { id: string; username: string }; status: string };

export function TeamDnD({ tournamentId, tournamentName, teams: serverTeams, freeAgents, isIndividual, tournamentTeams, allPlayers, teamSize }: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState(serverTeams);
  const [captainChanging, setCaptainChanging] = useState<string | null>(null);
  const [newCaptainId, setNewCaptainId] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showSearch, setShowSearch] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const registeredTeamIds = new Set(tournamentTeams.map((tt) => tt.teamId));
  const filteredTeams = teams.filter((t) => registeredTeamIds.has(t.id));

  // Sync with server data when prop changes
  useEffect(() => { setTeams(serverTeams); }, [serverTeams]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(null);
        setAddSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isIndividual) {
    return (
      <Card className="p-6 text-center">
        <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
        <p className="text-muted font-medium">Torneo individual</p>
        <p className="text-xs text-muted mt-1">Cada jugador compite por su cuenta</p>
      </Card>
    );
  }

  const addToTeam = useCallback(async (teamId: string, playerId: string) => {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player) return;

    // Check team size limit
    const targetTeam = teams.find((t) => t.id === teamId);
    if (targetTeam) {
      const activeCount = targetTeam.members.filter((m) => m.status === "ACTIVE").length;
      if (activeCount >= (teamSize || 5)) {
        setAddingTo(null);
        return;
      }
    }

    setAddingTo(teamId);
    setShowSearch(null);
    setAddSearch("");

    // Optimistic update
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        // Check if already a member
        const existing = t.members.find((m) => m.userId === playerId);
        if (existing) {
          return {
            ...t,
            members: t.members.map((m) =>
              m.userId === playerId ? { ...m, status: "ACTIVE" as const } : m
            ),
          };
        }
        const newMember: TeamMemberData = {
          id: `temp-${Date.now()}`,
          userId: player.id,
          user: player,
          status: "ACTIVE",
        };
        return { ...t, members: [...t.members, newMember] };
      })
    );

    // Server call
    await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: playerId }),
    });

    setAddSuccess(teamId);
    setTimeout(() => setAddSuccess(null), 2000);
    setAddingTo(null);
    router.refresh();
  }, [allPlayers, router]);

  const removeMember = useCallback(async (teamId: string, memberId: string) => {
    // Optimistic remove
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, members: t.members.filter((m) => m.id !== memberId) }
          : t
      )
    );
    await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
  }, []);

  const changeCaptain = useCallback(async (teamId: string) => {
    if (!newCaptainId) return;
    // Optimistic update
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, captainId: newCaptainId } : t
      )
    );
    await fetch(`/api/teams/${teamId}/captain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCaptainId }),
    });
    setCaptainChanging(null);
    setNewCaptainId("");
  }, [newCaptainId]);

  const disbandTeam = useCallback(async (teamId: string) => {
    if (!confirm("¿Eliminar este equipo? Los miembros volverán a ser agentes libres.")) return;
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }, []);

  const searchResults = allPlayers.filter((p) =>
    p.username.toLowerCase().includes(addSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Create new team */}
      <CreateTeamCard
        allPlayers={allPlayers}
        tournamentId={tournamentId}
        onCreated={() => window.location.reload()}
        disabled={addingTo !== null}
      />

      {/* Free agents panel */}
      {freeAgents.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold text-gold">Agentes libres ({freeAgents.length})</h3>
            <p className="text-[10px] text-muted">Jugadores sin equipo que pueden ser reclutados</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {freeAgents.map((fa) => (
              <span key={fa.id} className="px-2 py-0.5 bg-background border border-border rounded text-[10px] text-muted">
                {fa.username}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Duplicate member detection */}
      {(() => {
        const playerTeams = new Map<string, string[]>();
        for (const t of filteredTeams) {
          for (const m of t.members) {
            if (m.status !== "ACTIVE") continue;
            if (!playerTeams.has(m.userId)) playerTeams.set(m.userId, []);
            playerTeams.get(m.userId)!.push(t.name);
          }
        }
        const duplicates = Array.from(playerTeams.entries()).filter(([, teams]) => teams.length > 1);
        if (duplicates.length === 0) return null;
        return (
          <Card className="p-4 border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 text-red-400 font-bold text-xs">!</div>
              <h3 className="text-sm font-bold text-red-400">Jugadores en múltiples equipos</h3>
            </div>
            <p className="text-[10px] text-muted mb-2">Estos jugadores aparecen en más de un equipo. Esto puede causar conflictos en el bracket.</p>
            <div className="space-y-1">
              {duplicates.map(([userId, teamNames]) => {
                const name = allPlayers.find(p => p.id === userId)?.username || userId.slice(0,8);
                return (
                  <div key={userId} className="flex items-center gap-2 text-xs text-red-400">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted">en:</span>
                    {teamNames.map((tn, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-red-500/5 border border-red-500/20 rounded text-[10px]">{tn}</span>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {filteredTeams.length === 0 ? (
        <Card className="p-6 text-center">
          <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
          <p className="text-muted text-sm">No hay equipos registrados en este torneo</p>
          <p className="text-xs text-muted mt-1">Crea uno nuevo o registra capitanes desde Alta</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTeams.map((team) => {
            const activeMembers = team.members.filter((m) => m.status === "ACTIVE");
            const slots = Array.from({ length: teamSize || 5 }, (_, i) => i);
            const isProcessing = addingTo === team.id;
            const justAdded = addSuccess === team.id;

            return (
              <Card
                key={team.id}
                className={`p-4 transition-all duration-300 ${
                  justAdded ? "border-green-500/50 shadow-lg shadow-green-500/10" : ""
                } ${isProcessing ? "opacity-80" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-sm truncate">{team.name}</h3>
                    <span className="text-[10px] text-muted shrink-0">{activeMembers.length}/{teamSize || 5}</span>
                  </div>
                  <button onClick={() => disbandTeam(team.id)}
                    className="p-1.5 text-muted hover:text-red-400 transition-colors shrink-0" title="Disolver equipo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <Crown className="w-3 h-3 text-gold shrink-0" />
                  <span className="text-[10px] text-muted">Capitán: {team.captain.username}</span>
                  <button onClick={() => setCaptainChanging(captainChanging === team.id ? null : team.id)}
                    className="text-[9px] text-gold hover:underline shrink-0">cambiar</button>
                </div>

                {captainChanging === team.id && (
                  <div className="flex gap-1 mb-3">
                    <select value={newCaptainId} onChange={(e) => setNewCaptainId(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded-lg text-xs">
                      <option value="">Nuevo capitán...</option>
                      {activeMembers.filter((m) => m.userId !== team.captainId).map((m) => (
                        <option key={m.userId} value={m.userId}>{m.user.username}</option>
                      ))}
                    </select>
                    <button onClick={() => changeCaptain(team.id)}
                      className="px-3 py-1.5 bg-gold text-background rounded-lg text-[10px] font-bold">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {slots.map((i) => {
                    const member = activeMembers[i];
                    if (member) {
                      return (
                        <div key={member.userId} className="flex flex-col items-center gap-0.5 p-1.5 bg-background border border-border rounded-lg relative group">
                          <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold">
                            {member.user.username[0].toUpperCase()}
                          </div>
                          <span className="text-[8px] text-center leading-tight truncate w-full">{member.user.username}</span>
                          {member.userId === team.captainId && <Crown className="w-2.5 h-2.5 text-gold absolute -top-1 -right-1" />}
                          <button onClick={() => removeMember(team.id, member.id)}
                            className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center hidden group-hover:flex transition-opacity">
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      );
                    }
                    // Empty slot
                    return (
                      <div key={`empty-${i}`} className={`flex flex-col items-center justify-center p-1.5 border border-dashed rounded-lg min-h-[52px] transition-all ${
                        isProcessing ? "border-gold/50 bg-gold/5" : "border-border"
                      }`}>
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 text-gold animate-spin" />
                        ) : (
                          <span className="text-[8px] text-muted">Vacío</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Search and add */}
                <div className="relative">
                  {showSearch === team.id ? (
                    <div ref={searchRef}>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                        <input type="text" placeholder="Buscar jugador..." value={addSearch}
                          onChange={(e) => setAddSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder-muted focus:outline-none focus:border-gold"
                          autoFocus
                          disabled={isProcessing}
                        />
                      </div>
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-[180px] overflow-y-auto">
                        {searchResults.length === 0 ? (
                          <div className="p-2 text-xs text-muted text-center">Sin resultados</div>
                        ) : (
                          searchResults.map((p) => {
                            // Only check teams registered in this tournament
                            const inTeam = filteredTeams.filter(t =>
                              t.members.some(m => m.userId === p.id && m.status === "ACTIVE")
                            ).map(t => t.name);
                            const alreadyHere = inTeam.includes(team.name);
                            const inOtherTeam = inTeam.filter(n => n !== team.name);
                            return (
                              <button key={p.id}
                                onClick={() => { if (!isProcessing && !alreadyHere) addToTeam(team.id, p.id); }}
                                disabled={isProcessing || alreadyHere}
                                className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2 ${
                                  alreadyHere
                                    ? "opacity-40 cursor-not-allowed"
                                    : isProcessing ? "opacity-50" : "hover:bg-background"
                                }`}>
                                <div className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[8px] font-bold shrink-0">
                                  {p.username[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="block truncate">{p.username}</span>
                                  {alreadyHere ? (
                                    <span className="block text-[9px] text-green-400">✓ Ya está en este equipo</span>
                                  ) : inOtherTeam.length > 0 ? (
                                    <span className="block text-[9px] text-red-400">⚠ También en: {inOtherTeam.join(", ")}</span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowSearch(team.id)} disabled={isProcessing}
                      className="w-full py-1.5 text-[10px] text-gold border border-dashed border-gold/30 rounded-lg hover:bg-gold/5 transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                      {isProcessing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : justAdded ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      {isProcessing ? "Agregando..." : justAdded ? "Agregado" : "Agregar integrante"}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTeamCard({ allPlayers, tournamentId, onCreated, disabled }: {
  allPlayers: Player[];
  tournamentId: string;
  onCreated: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teamName, setTeamName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = search ? allPlayers.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  ) : [];

  const handleCreate = async () => {
    if (!selectedPlayer || !teamName.trim()) return;
    setCreating(true);
    const teamRes = await fetch("/api/teams", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName.trim(), captainId: selectedPlayer.id }),
    });
    if (!teamRes.ok) { setCreating(false); return; }
    const team = await teamRes.json();
    await fetch(`/api/tournaments/${tournamentId}/teams`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: team.id }),
    });
    setCreating(false);
    setOpen(false);
    setTeamName("");
    setSelectedPlayer(null);
    setSearch("");
    onCreated();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} disabled={disabled}
        className="w-full py-3 border-2 border-dashed border-gold/30 rounded-xl text-sm text-gold font-bold hover:bg-gold/5 hover:border-gold/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Nuevo equipo
      </button>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-bold text-gold">Crear nuevo equipo</h3>

      <input type="text" placeholder="Nombre del equipo" value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />

      {selectedPlayer ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-gold/5 border border-gold/30 rounded-lg text-sm">
          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold">{selectedPlayer.username[0].toUpperCase()}</div>
          <span className="flex-1">{selectedPlayer.username}</span>
          <button onClick={() => setSelectedPlayer(null)} className="text-muted hover:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input type="text" placeholder="Buscar capitán..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm" />
          {search.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-[180px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted text-center">Sin resultados</div>
              ) : (
                filtered.map((p) => (
                  <button key={p.id} onClick={() => { setSelectedPlayer(p); setSearch(""); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-background transition-colors flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold">{p.username[0].toUpperCase()}</div>
                    <span>{p.username}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={creating || !selectedPlayer || !teamName.trim()}
          className="flex-1 py-2.5 bg-gold text-background font-bold rounded-lg text-sm hover:bg-gold-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {creating ? "Creando..." : "CREAR EQUIPO"}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2.5 border border-border text-muted rounded-lg text-sm hover:border-gold/50">Cancelar</button>
      </div>
    </Card>
  );
}
