"use client";

/**
 * LoLLinkCard — vincula o desvincula la cuenta de Riot del usuario autenticado.
 *
 * Estados:
 *   - Sin vincular: form con inputs Riot ID + región
 *   - Vinculado: muestra Riot ID, nivel y enlace "Ver perfil de LoL" a /players/[userId]
 */
import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, AlertTriangle, Check, Loader2, Copy, Share2, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
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
  const { userId } = props;
  const [linked, setLinked] = useState(props.initialLinked);
  const [riotId, setRiotId] = useState(props.initialRiotId ?? "");
  const [region, setRegion] = useState(props.initialRegion ?? "la1");
  const [level, setLevel] = useState<number | null>(props.initialLevel);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Auto-dismiss share toast after 15s
  useEffect(() => {
    if (!shareUrl) return;
    const t = setTimeout(() => setShareUrl(null), 15000);
    return () => clearTimeout(t);
  }, [shareUrl]);

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
      setShareUrl(`${window.location.origin}/players/${userId}`);
      setCopied(false);
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
      {shareUrl && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded border border-gold/40 bg-background/80 text-foreground"
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-2 text-xs">
            <div className="flex items-center gap-1.5 text-gold font-medium">
              <Share2 className="w-3 h-3" />
              <span>Compartir perfil</span>
            </div>
            <button
              type="button"
              onClick={() => setShareUrl(null)}
              aria-label="Cerrar"
              className="text-muted hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 pb-2 pt-1.5">
            <code className="flex-1 min-w-0 truncate font-mono text-[11px] text-foreground/90 bg-background border border-border rounded px-2 py-1">
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard blocked — leave URL visible for manual copy */
                }
              }}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-gold/40 text-gold text-xs hover:bg-gold/10 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copiar
                </>
              )}
            </button>
          </div>
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
          <Link
            href={`/players/${userId}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-gold text-background hover:bg-gold-hover font-bold px-3 py-1.5 text-sm transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ver perfil de LoL
          </Link>
        </div>
      )}
    </Card>
  );
}
