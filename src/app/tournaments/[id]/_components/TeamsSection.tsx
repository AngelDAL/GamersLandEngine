"use client";

import { useState } from "react";
import { TeamApplyModal } from "./TeamApplyModal";
import { Users, UserPlus, Shield, Swords, User } from "lucide-react";

type Team = {
  id: string;
  name: string;
  captainId: string;
  _count: { members: number };
  members: { status: string }[];
  captain: { id: string; username: string };
};

type FreeAgent = {
  id: string;
  username: string;
};

type Props = {
  teams: Team[];
  freeAgents: FreeAgent[];
  tournamentId: string;
  userId?: string;
  isFreeAgent: boolean;
};

export function TeamsSection({ teams, freeAgents, tournamentId, userId, isFreeAgent }: Props) {
  const [applyTarget, setApplyTarget] = useState<{ id: string; name: string } | null>(null);

  const activeTeams = teams.filter((t) => t.members.some((m) => m.status === "ACTIVE"));

  return (
    <div className="space-y-6">
      {/* Teams */}
      <div>
        <h3 className="text-base font-bold text-gold flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4" />
          Equipos participantes ({activeTeams.length})
        </h3>

        {activeTeams.length === 0 ? (
          <div className="text-center py-6 bg-background rounded-xl border border-border">
            <Users className="w-8 h-8 text-muted mx-auto mb-2 opacity-30" />
            <p className="text-muted text-sm">Aún no hay equipos registrados</p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {activeTeams.map((team) => {
              const memberCount = team.members.filter((m) => m.status === "ACTIVE").length;
              const isFull = memberCount >= 5;
              const canApply = isFreeAgent && userId && userId !== team.captainId;

              return (
                <div key={team.id} className="bg-background border border-border rounded-xl p-3 hover:border-gold/30 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-bold text-sm">{team.name}</h4>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {team.captain.username}
                      </p>
                    </div>
                    <span className="text-xs text-muted">{memberCount}/5</span>
                  </div>
                  {!isFull && canApply && (
                    <button
                      onClick={() => setApplyTarget({ id: team.id, name: team.name })}
                      className="w-full mt-2 py-1.5 border border-gold text-gold rounded-lg text-xs font-bold hover:bg-gold/10 transition-colors flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      Postularse
                    </button>
                  )}
                  {isFull && (
                    <div className="w-full mt-2 py-1.5 text-xs text-muted text-center border border-border rounded-lg">
                      Equipo completo
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Free Agents */}
      {freeAgents.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-gold flex items-center gap-2 mb-3">
            <User className="w-4 h-4" />
            Jugadores sin equipo ({freeAgents.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {freeAgents.map((fa) => (
              <div key={fa.id} className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-muted">
                {fa.username}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyTarget && (
        <TeamApplyModal
          teamId={applyTarget.id}
          teamName={applyTarget.name}
          tournamentId={tournamentId}
          userId={userId!}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
