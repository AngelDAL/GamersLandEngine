"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/components/shared/Toast";
import {
  Gamepad2,
  Shield,
  Code,
  Copy,
  Check,
  Loader2,
  Trophy,
} from "lucide-react";

type Props = {
  tournament: {
    id: string;
    name: string;
    game: string;
    riotProviderId: number | null;
    riotTournamentId: number | null;
    riotMode: string | null;
    teamSize?: number;
    isTeamBased?: boolean;
  };
  isAdmin: boolean;
};

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gold" />
      </div>
      <h2 className="text-sm font-bold text-gold">{title}</h2>
    </div>
  );
}

export function RiotCodePanel({ tournament }: Props) {
  const router = useRouter();
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [codesCount, setCodesCount] = useState(1);
  const [codesLoading, setCodesLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const hasProvider = tournament.riotProviderId !== null;
  const hasTournament = tournament.riotTournamentId !== null;

  // ── Auto-register Provider (no user input needed) ──
  const ensureProvider = async (): Promise<boolean> => {
    if (hasProvider) return true;
    try {
      const res = await fetch(`/api/riot/provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // server fills region + callbackUrl
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al configurar Riot");
      }
      return true;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error al configurar Riot",
        "error"
      );
      return false;
    }
  };

  // ── Register Tournament (1-click) ──
  const registerTournament = async () => {
    setTournamentLoading(true);
    try {
      const ok = await ensureProvider();
      if (!ok) return;

      const res = await fetch(`/api/riot/tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al registrar torneo en Riot");
      }
      showToast("Torneo conectado con Riot ✅", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error al registrar torneo",
        "error"
      );
    }
    setTournamentLoading(false);
  };

  // ── Generate Codes (1-click) ──
  const generateCodes = async () => {
    setCodesLoading(true);
    setGeneratedCodes([]);
    try {
      const ok = await ensureProvider();
      if (!ok) return;

      const res = await fetch(`/api/riot/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          count: codesCount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al generar códigos en Riot");
      }
      const data = await res.json();
      const codes: string[] = Array.isArray(data.codes)
        ? data.codes
        : data.code
        ? [data.code]
        : [];
      setGeneratedCodes(codes);
      showToast(
        `${codes.length} código${codes.length === 1 ? "" : "s"} generado${codes.length === 1 ? "" : "s"}`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error al generar códigos",
        "error"
      );
    }
    setCodesLoading(false);
  };

  const copyCode = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      showToast("No se pudo copiar al portapapeles", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══════ Status + 1-Click Connect ═══════ */}
      <Card className="p-4">
        <SectionTitle icon={Trophy} title="Conexión con Riot Games" />

        {hasTournament ? (
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
            <Shield className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-xs sm:text-sm flex-1">
              Torneo conectado con Riot
            </span>
            <Badge variant="green">✅ Listo</Badge>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Conecta este torneo con Riot Games para generar códigos de partida
              oficiales. Solo necesitas hacer clic una vez — nos encargamos de la
              configuración técnica.
            </p>
            <Button
              onClick={registerTournament}
              disabled={tournamentLoading}
              size="sm"
            >
              {tournamentLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trophy className="w-3.5 h-3.5" />
              )}
              {tournamentLoading ? "Conectando..." : "Conectar con Riot Games"}
            </Button>
          </div>
        )}
      </Card>

      {/* ═══════ Generate Codes (only when connected) ═══════ */}
      {hasTournament && (
        <Card className="p-4">
          <SectionTitle icon={Code} title="Códigos de Partida" />

          <div className="flex items-end gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">
                ¿Cuántos códigos necesitas?
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={codesCount}
                onChange={(e) =>
                  setCodesCount(
                    Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                  )
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              />
              <p className="text-[10px] text-muted mt-1">
                Summoner's Rift · 5v5 · Tournament Draft · Espectadores libres
              </p>
            </div>
            <Button
              onClick={generateCodes}
              disabled={codesLoading}
              className="shrink-0"
            >
              {codesLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Gamepad2 className="w-3.5 h-3.5" />
              )}
              {codesLoading ? "Generando..." : "Generar"}
            </Button>
          </div>

          {/* Generated codes list */}
          {generatedCodes.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
                Códigos para los capitanes
              </h3>
              {generatedCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2"
                >
                  <code className="flex-1 min-w-0 text-xs sm:text-sm font-mono text-gold truncate">
                    {code}
                  </code>
                  <button
                    onClick={() => copyCode(code, idx)}
                    className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors text-muted hover:text-gold shrink-0"
                    title="Copiar código"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-muted mt-2">
                Comparte estos códigos con los capitanes de cada equipo. Ellos
                los ingresan en el Cliente de Torneo de League of Legends.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
