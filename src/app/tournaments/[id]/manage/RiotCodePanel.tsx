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
  ExternalLink,
  Settings,
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

const REGION_OPTIONS = [
  { value: "LAN", label: "LAN (Latinoamérica Norte)" },
  { value: "LA1", label: "LA1 (Latinoamérica)" },
  { value: "LA2", label: "LA2 (Latinoamérica Sur)" },
  { value: "NA1", label: "NA1 (Norteamérica)" },
  { value: "EUW1", label: "EUW1 (Europa Oeste)" },
  { value: "EUN1", label: "EUN1 (Europa Este)" },
  { value: "KR", label: "KR (Corea)" },
  { value: "BR1", label: "BR1 (Brasil)" },
  { value: "JP1", label: "JP1 (Japón)" },
  { value: "OC1", label: "OC1 (Oceanía)" },
  { value: "TR1", label: "TR1 (Turquía)" },
  { value: "RU", label: "RU (Rusia)" },
  { value: "PH2", label: "PH2 (Filipinas)" },
  { value: "SG2", label: "SG2 (Singapur)" },
  { value: "TH2", label: "TH2 (Tailandia)" },
  { value: "TW2", label: "TW2 (Taiwán)" },
  { value: "VN2", label: "VN2 (Vietnam)" },
];

const MAP_TYPES = [
  { value: "SUMMONERS_RIFT", label: "Summoner's Rift" },
  { value: "HOWLING_ABYSS", label: "Howling Abyss (ARAM)" },
];

const PICK_TYPES = [
  { value: "TOURNAMENT_DRAFT", label: "Tournament Draft" },
  { value: "ALL_RANDOM", label: "All Random" },
  { value: "BLIND_PICK", label: "Blind Pick" },
];

const SPECTATOR_TYPES = [
  { value: "ALL", label: "Todos pueden ver" },
  { value: "LOBBY_ONLY", label: "Solo la lobby" },
  { value: "NONE", label: "Sin espectadores" },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gold" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-gold">{title}</h2>
      </div>
    </div>
  );
}

export function RiotCodePanel({ tournament }: Props) {
  const router = useRouter();

  // ── Provider section ──
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [providerRegion, setProviderRegion] = useState("LAN");
  const [providerCallbackUrl, setProviderCallbackUrl] = useState(
    process.env.NEXT_PUBLIC_RIOT_CALLBACK_URL || "https://gamersland.test/callback"
  );
  const [providerLoading, setProviderLoading] = useState(false);

  // ── Tournament section ──
  const [tournamentLoading, setTournamentLoading] = useState(false);

  // ── Codes section ──
  const [codesCount, setCodesCount] = useState(1);
  const [mapType, setMapType] = useState("SUMMONERS_RIFT");
  const [pickType, setPickType] = useState("TOURNAMENT_DRAFT");
  const [spectatorType, setSpectatorType] = useState("ALL");
  const [teamSize, setTeamSize] = useState(tournament.teamSize || 5);
  const [codesLoading, setCodesLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<
    { code: string; lobbyId: string; id: number }[]
  >([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ── Register Provider ──
  const registerProvider = async () => {
    setProviderLoading(true);
    try {
      const res = await fetch(`/api/riot/provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: providerRegion,
          callbackUrl: providerCallbackUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al registrar provider en Riot");
      }
      showToast("Provider registrado correctamente en Riot", "success");
      setShowProviderForm(false);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error al registrar provider",
        "error"
      );
    }
    setProviderLoading(false);
  };

  // ── Register Tournament ──
  const registerTournament = async () => {
    setTournamentLoading(true);
    try {
      const res = await fetch(`/api/riot/tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          providerId: tournament.riotProviderId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al registrar torneo en Riot");
      }
      showToast("Torneo registrado correctamente en Riot", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Error al registrar torneo",
        "error"
      );
    }
    setTournamentLoading(false);
  };

  // ── Generate Codes ──
  const generateCodes = async () => {
    setCodesLoading(true);
    setGeneratedCodes([]);
    try {
      const res = await fetch(`/api/riot/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          count: codesCount,
          config: {
            mapType,
            pickType,
            spectatorType,
            teamSize,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al generar códigos en Riot");
      }
      const data = await res.json();
      const codes = data.codes || [];
      setGeneratedCodes(Array.isArray(codes) ? codes.map((c: string, i: number) => ({ code: c, lobbyId: "", id: i })) : []);
      showToast(
        `${Array.isArray(codes) ? codes.length : 1} código(s) generado(s)`,
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

  const copyCode = async (code: string, id: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast("No se pudo copiar al portapapeles", "error");
    }
  };

  const hasProvider = tournament.riotProviderId !== null;
  const hasTournament = tournament.riotTournamentId !== null;

  return (
    <div className="space-y-4">
      {/* ═══════ Provider Section ═══════ */}
      <Card className="p-4">
        <SectionTitle icon={Settings} title="Configuración de Riot" />

        {hasProvider ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-xs sm:text-sm">
                  Provider ID: <span className="font-mono text-gold">{tournament.riotProviderId}</span>
                </span>
              </div>
              <Badge variant="green">✅ Configurado</Badge>
            </div>
          </div>
        ) : showProviderForm ? (
          <div className="space-y-3 bg-background border border-border rounded-lg p-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Región
              </label>
              <select
                value={providerRegion}
                onChange={(e) => setProviderRegion(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={providerLoading}
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Callback URL
              </label>
              <input
                type="text"
                value={providerCallbackUrl}
                onChange={(e) => setProviderCallbackUrl(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                placeholder="https://gamersland.test/callback"
                disabled={providerLoading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={registerProvider}
                disabled={providerLoading}
                size="sm"
              >
                {providerLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                {providerLoading ? "Registrando..." : "Registrar Provider en Riot"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowProviderForm(false);
                  setProviderRegion("LAN");
                  setProviderCallbackUrl(
                    process.env.NEXT_PUBLIC_RIOT_CALLBACK_URL || "https://gamersland.test/callback"
                  );
                }}
                disabled={providerLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted mb-3">
              Registra este torneo como provider en Riot Games para habilitar la
              integración de códigos de partida.
            </p>
            <Button
              onClick={() => setShowProviderForm(true)}
              variant="outline"
              size="sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Registrar Provider en Riot
            </Button>
          </div>
        )}
      </Card>

      {/* ═══════ Tournament Section ═══════ */}
      <Card className="p-4">
        <SectionTitle icon={Trophy} title="Registro del Torneo" />

        {hasTournament ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-green-400" />
                <span className="text-xs sm:text-sm">
                  Riot Tournament ID:{" "}
                  <span className="font-mono text-gold">{tournament.riotTournamentId}</span>
                </span>
              </div>
              <Badge variant="green">✅ Registrado</Badge>
            </div>
          </div>
        ) : hasProvider ? (
          <div>
            <p className="text-xs text-muted mb-3">
              El torneo <strong className="text-foreground">{tournament.name}</strong> aún no está
              registrado en Riot. Al registrarlo se creará un torneo vinculado en la API de Riot Games.
            </p>
            <div className="bg-background border border-border rounded-lg px-3 py-2 mb-3">
              <InfoRow label="Nombre a registrar" value={tournament.name} />
            </div>
            <Button
              onClick={registerTournament}
              disabled={tournamentLoading}
              size="sm"
            >
              {tournamentLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {tournamentLoading ? "Registrando..." : "Registrar Torneo en Riot"}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted">
              Primero debes registrar un Provider en Riot desde la sección
              &quot;Configuración de Riot&quot; arriba.
            </p>
          </div>
        )}
      </Card>

      {/* ═══════ Codes Section ═══════ */}
      {hasTournament && (
        <Card className="p-4">
          <SectionTitle icon={Code} title="Generar Códigos de Partida" />

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Count */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Cantidad de códigos
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={codesCount}
                onChange={(e) =>
                  setCodesCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              />
            </div>

            {/* Team Size */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Tamaño del equipo
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={teamSize}
                onChange={(e) =>
                  setTeamSize(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              />
            </div>

            {/* Map Type */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Tipo de mapa
              </label>
              <select
                value={mapType}
                onChange={(e) => setMapType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              >
                {MAP_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pick Type */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Tipo de selección
              </label>
              <select
                value={pickType}
                onChange={(e) => setPickType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              >
                {PICK_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Spectator Type - full width */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">
                Tipo de espectadores
              </label>
              <select
                value={spectatorType}
                onChange={(e) => setSpectatorType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm"
                disabled={codesLoading}
              >
                {SPECTATOR_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <Button
              onClick={generateCodes}
              disabled={codesLoading}
              className="w-full sm:w-auto"
            >
              {codesLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Gamepad2 className="w-3.5 h-3.5" />
              )}
              {codesLoading ? "Generando..." : "Generar Códigos"}
            </Button>
          </div>

          {/* Generated codes list */}
          {generatedCodes.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
                Códigos generados ({generatedCodes.length})
              </h3>
              {generatedCodes.map((gc, idx) => (
                <div
                  key={gc.id ?? idx}
                  className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-xs sm:text-sm font-mono text-gold block truncate">
                      {gc.code}
                    </code>
                    {gc.lobbyId && (
                      <span className="text-[10px] text-muted">
                        Lobby ID: {gc.lobbyId}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyCode(gc.code, gc.id ?? idx)}
                    className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors text-muted hover:text-gold shrink-0"
                    title="Copiar código"
                  >
                    {copiedId === (gc.id ?? idx) ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
