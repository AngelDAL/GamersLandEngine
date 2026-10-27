"use client";

/**
 * LoLLinkCard — vincula o desvincula la cuenta de Riot del usuario autenticado.
 *
 * Estados:
 *   - Sin vincular: formulario con Riot ID + región, con CTA principal
 *   - Vinculado: muestra el Riot ID, el nivel y el enlace al perfil público
 *
 * Los mensajes (éxito y error) van con sonner; sonner publica cada aviso
 * como región viva, así que también se lee en lectores de pantalla.
 */
import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Loader2, Copy, Share2, X, ExternalLink, Check } from "lucide-react";
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
  ph2: "Filipinas", sg2: "Singapur", th2: "Tailandia",
  tw2: "Taiwán", vn2: "Vietnam",
};

export function LoLLinkCard(props: Props) {
  const router = useRouter();
  const { userId } = props;
  const [linked, setLinked] = useState(props.initialLinked);
  const [linkedRiotId, setLinkedRiotId] = useState(props.initialRiotId);
  const [riotId, setRiotId] = useState(props.initialRiotId ?? "");
  const [region, setRegion] = useState(props.initialRegion ?? "la1");
  const [level, setLevel] = useState<number | null>(props.initialLevel);
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
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile/riot-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ riotId, region }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo vincular la cuenta.");
          return;
        }
        const profile = data.profile ?? {};
        setLinked(true);
        setLinkedRiotId(`${profile.gameName}#${profile.tagLine}`);
        setLevel(typeof profile.summonerLevel === "number" ? profile.summonerLevel : null);
        toast.success(`Vinculado: ${profile.gameName}#${profile.tagLine}`);
        setShareUrl(`${window.location.origin}/players/${userId}`);
        setCopied(false);
        router.refresh();
      } catch {
        toast.error("Error de conexión. Intenta de nuevo.");
      }
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5" />
        League of Legends
      </h2>

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
              className="min-h-[40px] min-w-[40px] -my-1 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
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
              className="shrink-0 inline-flex items-center justify-center gap-1 min-h-[40px] px-3 rounded border border-gold/40 text-gold text-xs hover:bg-gold/10 transition-colors"
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
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (riotId.includes("#")) onLink();
          }}
        >
          <div>
            <label className="text-xs text-muted block mb-1" htmlFor="riot-id">
              Riot ID
            </label>
            <input
              id="riot-id"
              type="text"
              value={riotId}
              onChange={(e) => setRiotId(e.target.value)}
              placeholder="GameName#TAG"
              autoComplete="off"
              className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1" htmlFor="riot-region">
              Región
            </label>
            <select
              id="riot-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm text-foreground"
            >
              {Object.entries(REGION_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={isPending || !riotId.includes("#")}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Vincular cuenta de LoL"
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <p className="text-foreground font-medium truncate">
                {linkedRiotId ?? "Cuenta vinculada"}
              </p>
              <p className="text-xs text-muted">
                {REGION_LABELS[props.initialRegion ?? region] ?? region}
                {level !== null && (
                  <span className="ml-2">Nivel {level}</span>
                )}
              </p>
            </div>
            <span
              className="w-2 h-2 rounded-full bg-green-400 shrink-0"
              title="Cuenta vinculada"
            />
          </div>
          <Link
            href={`/players/${userId}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-gold text-background hover:bg-gold-hover font-bold px-3 py-2.5 text-sm transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ver perfil de LoL
          </Link>
        </div>
      )}
    </Card>
  );
}
