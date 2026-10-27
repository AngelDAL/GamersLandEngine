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
  const [disbanding, setDisbanding] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<{ teamId: string; memberId: string; name: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const registeredTeamIds = new Set(tournamentTeams.map((tt) => tt.teamId));
  const filteredTeams = teams.filter((t) => registeredTeamIds.has(t.id));

  // Sincroniza con los datos del servidor cuando cambian (patrón permitido:
  // se compara durante el render, no dentro de un efecto).
  const [prevServerTeams, setPrevServerTeams] = useState(serverTeams);
  if (serverTeams !== prevServerTeams) {
    setPrevServerTeams(serverTeams);
    setTeams(serverTeams);
  }

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
  }, [allPlayers, teams, teamSize, router]);

  // La confirmación vive en un modal del sistema: nunca confirm() nativo.
  const confirmDisband = async () => {
    if (!disbanding) return;
    await fetch(`/api/teams/${disbanding}`, { method: "DELETE" });
    setTeams((prev) => prev.filter((t) => t.id !== disbanding));
    setDisbanding(null);
    router.refresh();
  };

  const confirmRemoveMember = async () => {
    if (!removingMember) return;
    const { teamId, memberId } = removingMember;
    // Optimistic remove
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== memberId) } : t
      )
    );
    await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
    setRemovingMember(null);
    router.refresh();
  };

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

  const searchResults = allPlayers.filter((p) =>
    p.username.toLowerCase().includes(addSearch.toLowerCase())
  );

  if (isIndividual) {
    return (
      <Card className="p-6 text-center">
        <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
        <p className="text-muted font-medium">Torneo individual</p>
        <p className="text-xs text-muted mt-1">Cada jugador compite por su cuenta</p>
      </Card>
    );
  }

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
                  <button onClick={() => setDisbanding(team.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted hover:text-red-400 transition-colors shrink-0" title="Disolver equipo">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <Crown className="w-3 h-3 text-gold shrink-0" />
                  <span className="text-[10px] text-muted">Capitán: {team.captain.username}</span>
                  <button onClick={() => setCaptainChanging(captainChanging === team.id ? null : team.id)}
                    className="min-h-[40px] px-2 -my-2 text-[10px] text-gold hover:underline shrink-0">cambiar</button>
                </div>

                {captainChanging === team.id && (
                  <div className="flex gap-1 mb-3">
                    <select value={newCaptainId} onChange={(e) => setNewCaptainId(e.target.value)}
                      className="flex-1 min-h-[40px] px-2 py-2 bg-background border border-border rounded-lg text-xs">
                      <option value="">Nuevo capitán...</option>
                      {activeMembers.filter((m) => m.userId !== team.captainId).map((m) => (
                        <option key={m.userId} value={m.userId}>{m.user.username}</option>
                      ))}
                    </select>
                    <button onClick={() => changeCaptain(team.id)}
                      className="min-h-[40px] px-3 py-2 bg-gold text-background rounded-lg text-[10px] font-bold flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-1.5 mb-3">
                  {slots.map((i) => {
                    const member = activeMembers[i];
                    if (member) {
                      return (
                        <div key={member.userId} className="flex items-center gap-2 p-1.5 bg-background border border-border rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                            {member.user.username[0].toUpperCase()}
                          </div>
                          <span className="text-xs flex-1 min-w-0 truncate">{member.user.username}</span>
                          {member.userId === team.captainId && (
                            <span className="flex items-center gap-1 text-[9px] text-gold shrink-0">
                              <Crown className="w-3 h-3" /> Capitán
                            </span>
                          )}
                          <button
                            onClick={() => setRemovingMember({ teamId: team.id, memberId: member.id, name: member.user.username })}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted hover:text-red-400 transition-colors shrink-0"
                            title="Quitar del equipo">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }
                    // Empty slot
                    return (
                      <div key={`empty-${i}`} className={`flex items-center justify-center min-h-[40px] px-2 border border-dashed rounded-lg transition-all ${
                        isProcessing ? "border-gold/50 bg-gold/5" : "border-border"
                      }`}>
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 text-gold animate-spin" />
                        ) : (
                          <span className="text-[9px] text-muted">Vacío</span>
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
                          className="w-full pl-7 pr-2 min-h-[40px] py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder-muted focus:outline-none focus:border-gold"
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
                                    <span className="block text-[9px] text-green-400">Ya está en este equipo</span>
                                  ) : inOtherTeam.length > 0 ? (
                                    <span className="block text-[9px] text-red-400">También en: {inOtherTeam.join(", ")}</span>
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
                      className="w-full min-h-[40px] py-2 text-[11px] text-gold border border-dashed border-gold/30 rounded-lg hover:bg-gold/5 transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
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

      {/* ── Confirmación: disolver equipo ── */}
      {disbanding && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Disolver equipo</h2>
            <p className="text-sm text-muted mb-6">
              ¿Disolver <strong className="text-foreground">{teams.find((t) => t.id === disbanding)?.name}</strong> en {tournamentName}?
              Sus miembros volverán a ser agentes libres.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDisband}
                className="flex-1 py-3 min-h-[44px] bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600"
              >
                Disolver
              </button>
              <button
                onClick={() => setDisbanding(null)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación: quitar miembro ── */}
      {removingMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <X className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Quitar del equipo</h2>
            <p className="text-sm text-muted mb-6">
              ¿Quitar a <strong className="text-foreground">{removingMember.name}</strong> del equipo?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmRemoveMember}
                className="flex-1 py-3 min-h-[44px] bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600"
              >
                Quitar
              </button>
              <button
                onClick={() => setRemovingMember(null)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
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
