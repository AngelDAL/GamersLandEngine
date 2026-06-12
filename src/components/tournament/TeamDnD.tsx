"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, Shield, Trash2, Crown,
  X, Check, UserMinus, UserCheck, Plus,
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
};

const TEAM_SIZE = 5;

export function TeamDnD({ tournamentId, tournamentName, teams, freeAgents, isIndividual }: Props) {
  const router = useRouter();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [captainChanging, setCaptainChanging] = useState<string | null>(null);
  const [newCaptainId, setNewCaptainId] = useState("");

  if (isIndividual) {
    return (
      <Card className="p-6 text-center">
        <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
        <p className="text-muted font-medium">Torneo individual</p>
        <p className="text-xs text-muted mt-1">Cada jugador compite por su cuenta</p>
      </Card>
    );
  }

  const addToTeam = async (teamId: string, playerId: string) => {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: playerId, message: "Asignado por organizador" }),
    });
    if (res.ok) {
      const member = await res.json();
      await fetch(`/api/teams/${teamId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
    }
    setAddingTo(null);
    router.refresh();
  };

  const removeMember = async (teamId: string, userId: string) => {
    const memberRecord = teams.find((t) => t.id === teamId)?.members.find((m) => m.userId === userId);
    if (!memberRecord) return;
    await fetch(`/api/teams/${teamId}/members/${memberRecord.id}`, { method: "DELETE" });
    router.refresh();
  };

  const changeCaptain = async (teamId: string) => {
    if (!newCaptainId) return;
    await fetch(`/api/teams/${teamId}/captain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCaptainId }),
    });
    setCaptainChanging(null);
    setNewCaptainId("");
    router.refresh();
  };

  const disbandTeam = async (teamId: string) => {
    if (!confirm("¿Eliminar este equipo? Los miembros volverán a agentes libres.")) return;
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* FREE AGENTS */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold text-gold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Agentes libres
          </h2>
          <span className="text-xs text-muted">{freeAgents.length}</span>
        </div>

        <div className="space-y-1.5 min-h-[120px]">
          {freeAgents.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs">
              <p>Todos los registrados están en equipos</p>
            </div>
          ) : (
            freeAgents.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
                <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                  {p.username[0].toUpperCase()}
                </div>
                <span className="text-xs sm:text-sm font-medium flex-1 truncate">{p.username}</span>
                {/* Mobile: add to team via dropdown */}
                <select
                  onChange={(e) => { if (e.target.value) addToTeam(e.target.value, p.id); e.target.value = ""; }}
                  className="text-[10px] px-2 py-1 bg-gold/10 text-gold rounded-lg border border-gold/30 cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>+ Equipo</option>
                  {teams.map((t) => {
                    const count = t.members.filter((m) => m.status === "ACTIVE").length;
                    if (count >= TEAM_SIZE) return null;
                    return <option key={t.id} value={t.id}>{t.name} ({count}/{TEAM_SIZE})</option>;
                  })}
                </select>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* TEAMS */}
      <div className="space-y-3">
        {teams.length === 0 ? (
          <Card className="p-6 text-center">
            <Users className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
            <p className="text-muted text-sm">No hay equipos registrados</p>
            <p className="text-xs text-muted mt-1">Registra jugadores como Capitanes desde Alta</p>
          </Card>
        ) : (
          teams.map((team) => {
            const activeMembers = team.members.filter((m) => m.status === "ACTIVE");
            const slots = Array.from({ length: TEAM_SIZE }, (_, i) => i);
            const isFull = activeMembers.length >= TEAM_SIZE;

            return (
              <Card key={team.id} className="p-3 sm:p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-sm truncate">{team.name}</h3>
                    <span className="text-[10px] text-muted shrink-0">{activeMembers.length}/{TEAM_SIZE}</span>
                  </div>
                  <button
                    onClick={() => disbandTeam(team.id)}
                    className="p-1 text-muted hover:text-red-400 transition-colors shrink-0"
                    title="Eliminar equipo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Captain */}
                <div className="flex items-center gap-1.5 mb-2">
                  <Crown className="w-3 h-3 text-gold shrink-0" />
                  <span className="text-[10px] text-muted">Capitán: {team.captain.username}</span>
                  <button
                    onClick={() => setCaptainChanging(captainChanging === team.id ? null : team.id)}
                    className="text-[9px] text-gold hover:underline shrink-0"
                  >
                    cambiar
                  </button>
                </div>

                {/* Captain change inline */}
                {captainChanging === team.id && (
                  <div className="flex gap-1 mb-2">
                    <select
                      value={newCaptainId}
                      onChange={(e) => setNewCaptainId(e.target.value)}
                      className="flex-1 px-2 py-1 bg-background border border-border rounded text-[10px]"
                    >
                      <option value="">Seleccionar nuevo capitán...</option>
                      {activeMembers
                        .filter((m) => m.userId !== team.captainId)
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>{m.user.username}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => changeCaptain(team.id)}
                      className="px-2 py-1 bg-gold text-background rounded text-[10px] font-bold"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Slots grid */}
                <div className="grid grid-cols-5 gap-1">
                  {slots.map((i) => {
                    const member = activeMembers[i];
                    if (member) {
                      return (
                        <div
                          key={member.userId}
                          className="flex flex-col items-center gap-0.5 p-1.5 bg-background border border-border rounded-lg relative group"
                        >
                          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[8px] font-bold">
                            {member.user.username[0].toUpperCase()}
                          </div>
                          <span className="text-[8px] text-center leading-tight truncate w-full">
                            {member.user.username.split(" ")[0]}
                          </span>
                          {member.userId === team.captainId && (
                            <Crown className="w-2.5 h-2.5 text-gold absolute -top-1 -right-1" />
                          )}
                          <button
                            onClick={() => removeMember(team.id, member.userId)}
                            className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center hidden group-hover:flex transition-opacity"
                          >
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      );
                    }

                    // Empty slot - show add button
                    return (
                      <div
                        key={`empty-${i}`}
                        className="flex flex-col items-center justify-center p-1.5 border border-dashed border-border rounded-lg min-h-[48px]"
                      >
                        {!isFull && freeAgents.length > 0 && (
                          <select
                            onChange={(e) => { if (e.target.value) addToTeam(team.id, e.target.value); e.target.value = ""; }}
                            className="text-[8px] text-muted bg-transparent border-none cursor-pointer text-center w-full"
                            defaultValue=""
                          >
                            <option value="" disabled>+</option>
                            {freeAgents.map((p) => (
                              <option key={p.id} value={p.id}>{p.username}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
