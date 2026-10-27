"use client";

import { useState } from "react";
import { Key, Copy, Check, Loader2, Lock, Eye } from "lucide-react";

type Props = {
  matchId: string;
  /** True when the logged-in user is a member of one of the two teams in this match. */
  userIsInMatch: boolean;
  /** True when the logged-in user is the organizer/admin and can see every code. */
  canEdit: boolean;
};

/**
 * Renders the Riot tournament code for a single match.
 *
 * Visibility rules:
 * - Admin/organizer (canEdit): always sees the code.
 * - Team member (userIsInMatch): sees the code for their own match only.
 * - Anyone else: sees a "Code visible to team captains" hint.
 *
 * The code is fetched lazily on first reveal and cached in component state.
 */
export function RiotMatchCode({ matchId, userIsInMatch, canEdit }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const canSee = canEdit || userIsInMatch;

  const fetchCode = async () => {
    if (code) {
      setRevealed(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/code`);
      if (res.ok) {
        const data = await res.json();
        setCode(data.code);
        setRevealed(true);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError("No tienes acceso a este código");
        } else if (res.status === 400) {
          setError(data.error || "Este partido no usa códigos de Riot");
        } else {
          setError(data.error || "No se pudo cargar el código");
        }
      }
    } catch (e) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  // Spectator: not in this match and not admin
  if (!canSee) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted py-1">
        <Lock className="w-3 h-3" />
        <span>Código visible solo para los capitanes de la partida</span>
      </div>
    );
  }

  // Admin or team member: show the code (revealed or hidden behind a click)
  if (!revealed) {
    return (
      <button
        onClick={fetchCode}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
        <span>Ver código de torneo</span>
      </button>
    );
  }

  if (error) {
    return (
      <div className="text-[10px] text-red-400 text-center py-1">{error}</div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        <Key className="w-3 h-3" />
        <span className="uppercase tracking-wider font-bold">Código Riot</span>
        <span className="text-[9px] text-muted/70">(úsalo en el cliente de torneo)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 px-2 py-1.5 bg-background border border-gold/30 rounded text-xs font-mono text-gold break-all">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1.5 border border-gold/30 rounded hover:bg-gold/10 transition-colors"
          title="Copiar código"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-gold" />
          )}
        </button>
      </div>
    </div>
  );
}
