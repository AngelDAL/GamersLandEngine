"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Gift, X, AlertTriangle } from "lucide-react";

type Prize = {
  id: string;
  name: string;
  value: string | null;
  maxClaims: number | null;
  tournament: { id: string; name: string };
};

type ScannedPlayer = {
  user: { id: string; username: string; avatarUrl: string | null; role: string };
  matchHistory: { result: string; tournament: string }[];
  availablePrizes: Prize[];
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  ORGANIZER: "Organizador",
  PLAYER: "Jugador",
  SPONSOR: "Patrocinador",
  EXPOSITOR: "Expositor",
  EJECUTIVO: "Ejecutivo",
};

type Props = { sponsorId: string };

export function SponsorScanClient({ sponsorId }: Props) {
  void sponsorId;
  const [search, setSearch] = useState("");
  const [player, setPlayer] = useState<ScannedPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [confirmPrize, setConfirmPrize] = useState<Prize | null>(null);
  const [delivering, setDelivering] = useState(false);

  const searchPlayer = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setPlayer(null);

    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: search.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No encontramos a ese jugador. Verifica el nombre o el código.");
        return;
      }

      const data = await res.json();
      setPlayer(data);
    } catch {
      setError("No pudimos buscar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const deliverPrize = async (prize: Prize) => {
    if (!player) return;
    setDelivering(true);
    setClaiming(prize.id);

    try {
      // El torneo se deriva del premio, nunca de la primera inscripción
      const res = await fetch(
        `/api/tournaments/${prize.tournament.id}/prizes/${prize.id}/claims`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: player.user.id }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo entregar el premio.");
        return;
      }

      toast.success(`Premio entregado a ${player.user.username}`);
      setConfirmPrize(null);
      await searchPlayer();
    } catch {
      toast.error("No se pudo entregar el premio. Intenta de nuevo.");
    } finally {
      setDelivering(false);
      setClaiming(null);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold text-gold mb-4">Escanear jugador</h2>
      <p className="text-xs text-muted mb-3">
        Ingresa el username o el código QR del jugador para entregarle sus premios.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre de usuario o código QR..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchPlayer()}
          className="flex-1 px-3 py-2.5 min-h-11 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-gold"
          autoFocus
        />
        <Button onClick={searchPlayer} disabled={loading || !search.trim()} size="sm" className="min-h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-1">Buscar</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {player && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-background rounded">
            {player.user.avatarUrl ? (
              <img src={player.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                {player.user.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-bold text-gold">{player.user.username}</p>
              <p className="text-xs text-muted">{roleLabels[player.user.role] || "Jugador"}</p>
            </div>
          </div>

          {player.matchHistory.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gold mb-2">Historial ({player.matchHistory.length} partidas)</p>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {player.matchHistory.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-muted truncate">{m.tournament}</span>
                    <Badge variant={m.result === "WON" ? "green" : "red"}>
                      {m.result === "WON" ? "Victoria" : m.result === "LOST" ? "Derrota" : m.result === "DRAW" ? "Empate" : "Sin jugar"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {player.availablePrizes.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gold mb-2">Premios disponibles</p>
              <div className="space-y-2">
                {player.availablePrizes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-background rounded gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted truncate">{p.tournament.name}{p.value ? ` — ${p.value}` : ""}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setConfirmPrize(p)}
                      disabled={claiming === p.id}
                      className="min-h-10 shrink-0"
                    >
                      {claiming === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                      <span className="ml-1">Entregar</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">
              {player.matchHistory.length > 0
                ? "Este jugador no tiene premios pendientes por reclamar."
                : "No hay premios disponibles para este jugador."}
            </p>
          )}
        </div>
      )}

      {/* Confirmación de entrega */}
      {confirmPrize && player && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !delivering && setConfirmPrize(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">Entregar premio</h3>
              <button
                onClick={() => !delivering && setConfirmPrize(null)}
                className="p-2 -m-1 text-muted hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm shrink-0">
                  {player.user.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{player.user.username}</p>
                  <p className="text-[11px] text-muted">Jugador</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gold/5 rounded-xl border border-gold/20">
                <Gift className="w-5 h-5 text-gold shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gold truncate">{confirmPrize.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {confirmPrize.tournament.name}{confirmPrize.value ? ` — ${confirmPrize.value}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmPrize(null)}
                disabled={delivering}
                className="px-4 py-2.5 min-h-10 text-sm font-bold text-muted border border-border rounded-xl hover:bg-background transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deliverPrize(confirmPrize)}
                disabled={delivering}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold bg-gold text-background rounded-xl hover:bg-gold-hover transition-colors disabled:opacity-50"
              >
                {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                Confirmar entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
