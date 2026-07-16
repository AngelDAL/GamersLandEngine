"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Crosshair, Swords, Shield, Loader2, AlertCircle } from "lucide-react";

type LoLProfile = {
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  soloRank: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  flexRank: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  topChampions: { championId: number; name: string; level: number; points: number }[];
};

type TeamRequest = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  message: string | null;
  team: { id: string; name: string; captain: { id: string; username: string } };
  lolProfile: LoLProfile | null;
};

type Props = { tournamentId: string };

const TIER_COLORS: Record<string, string> = {
  iron: "text-gray-400",
  bronze: "text-amber-700",
  silver: "text-gray-300",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  emerald: "text-emerald-400",
  diamond: "text-blue-400",
  master: "text-purple-400",
  grandmaster: "text-red-400",
  challenger: "text-yellow-200",
};

export function TeamRequestsPanel({ tournamentId }: Props) {
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/team-requests`)
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar solicitudes");
        return r.json();
      })
      .then((data) => {
        setRequests(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [tournamentId]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando solicitudes...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-red-500/30">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </Card>
    );
  }

  if (requests.length === 0) return null;

  return (
    <Card className="p-4 border-gold/20 mb-4">
      <h2 className="text-sm font-bold text-gold flex items-center gap-2 mb-4">
        <Users className="w-4 h-4" />
        Solicitudes de equipo ({requests.length})
      </h2>

      <div className="space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-xl bg-background border border-border"
          >
            {/* Header: username + team + badge */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                  {req.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold">{req.username}</p>
                  <p className="text-[10px] text-muted">
                    Quiere unirse a{" "}
                    <strong className="text-gold">{req.team.name}</strong>
                    {req.message && <> — &quot;{req.message}&quot;</>}
                  </p>
                </div>
              </div>
              <Badge variant="gold" className="text-[10px]">
                Pendiente
              </Badge>
            </div>

            {/* LoL Profile section */}
            {req.lolProfile ? (
              <div className="mt-2 pt-2 border-t border-border/50">
                {/* Summoner info */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {req.lolProfile.profileIconId > 0 && (
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/15.6.1/img/profileicon/${req.lolProfile.profileIconId}.png`}
                        alt=""
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-xs font-bold text-foreground">
                      {req.lolProfile.gameName}
                      <span className="text-muted">
                        #{req.lolProfile.tagLine}
                      </span>
                    </span>
                    <span className="text-[9px] text-muted">
                      Nv. {req.lolProfile.summonerLevel}
                    </span>
                  </div>
                </div>

                {/* Ranks & Champions */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                  {req.lolProfile.soloRank && (
                    <span className="flex items-center gap-1">
                      <Swords className="w-3 h-3 text-muted shrink-0" />
                      <span
                        className={
                          TIER_COLORS[
                            req.lolProfile.soloRank.tier.toLowerCase()
                          ] || "text-muted"
                        }
                      >
                        {req.lolProfile.soloRank.tier}{" "}
                        {req.lolProfile.soloRank.rank}
                      </span>
                      <span className="text-muted">
                        {req.lolProfile.soloRank.lp} LP
                      </span>
                    </span>
                  )}

                  {req.lolProfile.flexRank && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-muted shrink-0" />
                      <span
                        className={
                          TIER_COLORS[
                            req.lolProfile.flexRank.tier.toLowerCase()
                          ] || "text-muted"
                        }
                      >
                        {req.lolProfile.flexRank.tier}{" "}
                        {req.lolProfile.flexRank.rank}
                      </span>
                    </span>
                  )}

                  {req.lolProfile!.topChampions.length > 0 && (
                    <div className="flex items-center gap-1.5 w-full mt-1">
                      <Crosshair className="w-3 h-3 text-muted shrink-0" />
                      <span className="text-muted">Mains:</span>
                      {req.lolProfile!.topChampions.map((champ, i) => (
                        <span
                          key={champ.championId}
                          className="text-foreground font-medium"
                        >
                          {champ.name}
                          <span className="text-muted">
                            ({champ.level})
                          </span>
                          {i < req.lolProfile!.topChampions.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted mt-1">
                Sin cuenta de League of Legends vinculada
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
