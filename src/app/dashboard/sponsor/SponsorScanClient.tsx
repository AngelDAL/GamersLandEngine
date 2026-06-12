"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = { sponsorId: string };

export function SponsorScanClient({ sponsorId }: Props) {
  const [search, setSearch] = useState("");
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);

  const searchPlayer = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setPlayer(null);

    const res = await fetch("/api/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: search.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Jugador no encontrado");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setPlayer(data);
    setLoading(false);
  };

  const claimPrize = async (prizeId: string) => {
    if (!player) return;
    setClaiming(prizeId);

    await fetch(`/api/tournaments/${player.tournaments[0]?.tournament?.id}/prizes/${prizeId}/claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: player.user.id }),
    });

    setClaiming(null);
    // Re-fetch to update available prizes
    await searchPlayer();
  };

  return (
    <Card>
      <h2 className="text-lg font-bold text-gold mb-4">Escanear Jugador</h2>
      <p className="text-xs text-muted mb-3">
        Ingresa el username o código QR del jugador para ver su información y premios disponibles.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Username o código QR..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchPlayer()}
          className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:border-gold"
          autoFocus
        />
        <Button onClick={searchPlayer} disabled={loading || !search.trim()} size="sm">
          Buscar
        </Button>
      </div>

      {error && <p className="text-red text-sm mb-3">{error}</p>}

      {player && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-background rounded">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
              {player.user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gold">{player.user.username}</p>
              <p className="text-xs text-muted">{player.user.role}</p>
            </div>
          </div>

          {player.matchHistory.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gold mb-2">Historial ({player.matchHistory.length} partidas)</p>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {player.matchHistory.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-muted truncate">{m.tournament}</span>
                    <Badge variant={m.result === "WON" ? "green" : "red"}>{m.result}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {player.availablePrizes?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gold mb-2">Premios Disponibles</p>
              <div className="space-y-2">
                {player.availablePrizes.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-background rounded">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.tournament.name} — {p.value}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => claimPrize(p.id)}
                      disabled={claiming === p.id}
                    >
                      {claiming === p.id ? "..." : "Entregar"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {player.availablePrizes?.length === 0 && player.matchHistory.length > 0 && (
            <p className="text-xs text-muted">No hay premios disponibles para este jugador</p>
          )}
        </div>
      )}
    </Card>
  );
}
