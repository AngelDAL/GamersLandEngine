"use client";

/**
 * LoLLinkCard — vincula o desvincula la cuenta de Riot del usuario autenticado.
 *
 * Estados:
 *   - Sin vincular: form con inputs Riot ID + región
 *   - Vinculado: muestra Riot ID, nivel, "Desvincular" + "Refrescar" (con cooldown)
 *
 * El "Refrescar" usa POST /api/profile/riot-refresh que respeta un cooldown de 5 min.
 */
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Unlink, Link2, AlertTriangle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  initialLinked: boolean;
  initialRiotId: string | null;        // "GameName#TAG"
  initialRegion: string | null;
  initialLevel: number | null;
  lastRefreshedAt: string | null;      // ISO
};

const REGION_LABELS: Record<string, string> = {
  la1: "LAN (México)", la2: "LAS (Sur)",
  na1: "NA", br1: "BR",
  euw1: "EUW", eun1: "EUNE",
  kr: "KR", jp1: "JP",
  oc1: "OCE", tr1: "TR", ru: "RU",
};

export function LoLLinkCard(props: Props) {
  const router = useRouter();
  const [linked, setLinked] = useState(props.initialLinked);
  const [riotId, setRiotId] = useState(props.initialRiotId ?? "");
  const [region, setRegion] = useState(props.initialRegion ?? "la1");
  const [level, setLevel] = useState<number | null>(props.initialLevel);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Tick cooldown countdown
  if (cooldownLeft > 0) {
    setTimeout(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
  }

  function onLink() {
    setErr(null); setOkMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/profile/riot-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId, region }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Error al vincular.");
        return;
      }
      setLinked(true);
      setLevel(data.profile.summonerLevel);
      setOkMsg(`Vinculado: ${data.profile.gameName}#${data.profile.tagLine}`);
      router.refresh();
    });
  }

  function onUnlink() {
    setErr(null); setOkMsg(null);
    if (!confirm("¿Desvincular tu Riot ID? Tu historial de partidas se preserva.")) return;
    startTransition(async () => {
      const res = await fetch("/api/profile/riot-link", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Error al desvincular.");
        return;
      }
      setLinked(false);
      setLevel(null);
      setOkMsg("Desvinculado. Tu historial sigue guardado.");
      router.refresh();
    });
  }

  function onRefresh() {
    setErr(null); setOkMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/profile/riot-refresh", { method: "POST" });
      const data = await res.json();
      if (res.status === 429) {
        setCooldownLeft(data.cooldownSecondsLeft ?? 300);
        setErr(`Cooldown activo (${Math.ceil((data.cooldownSecondsLeft ?? 0) / 60)} min).`);
        return;
      }
      if (!res.ok) {
        setErr(data.error ?? "Error al refrescar.");
        return;
      }
      setOkMsg("Perfil refrescado.");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5" />
        League of Legends
      </h2>

      {err && (
        <div className="mb-3 p-2 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      {okMsg && (
        <div className="mb-3 p-2 rounded border border-green-500/30 bg-green-500/10 text-green-300 text-xs flex items-start gap-2">
          <Check className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{okMsg}</span>
        </div>
      )}

      {!linked ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Vincula tu Riot ID para mostrar tu perfil LoL en{" "}
            <span className="text-gold">/players/[tu-id]</span>. Tu historial de
            partidas se guarda aunque te desvincules.
          </p>
          <div>
            <label className="text-xs text-muted block mb-1">Riot ID</label>
            <input
              type="text"
              value={riotId}
              onChange={(e) => setRiotId(e.target.value)}
              placeholder="GameName#TAG"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Región</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              {Object.entries(REGION_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <Button onClick={onLink} disabled={isPending || !riotId.includes("#")} size="sm" className="w-full">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vincular"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-foreground font-medium">{props.initialRiotId}</p>
              <p className="text-xs text-muted">
                {REGION_LABELS[props.initialRegion ?? "la1"] ?? props.initialRegion}
                {level !== null && (
                  <span className="ml-2">Nivel {level}</span>
                )}
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="flex gap-2">
            <Button onClick={onRefresh} disabled={isPending || cooldownLeft > 0} size="sm" variant="outline" className="flex-1">
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              {cooldownLeft > 0 ? `Espera ${cooldownLeft}s` : "Refrescar"}
            </Button>
            <Button onClick={onUnlink} disabled={isPending} size="sm" variant="ghost" className="flex-1 text-red-400 hover:bg-red-500/10">
              <Unlink className="w-3 h-3 mr-1" /> Desvincular
            </Button>
          </div>
          <p className="text-[10px] text-muted">
            Refrescar: máx 12 veces/hora (cooldown 5 min). Tu historial se queda guardado.
          </p>
        </div>
      )}
    </Card>
  );
}
