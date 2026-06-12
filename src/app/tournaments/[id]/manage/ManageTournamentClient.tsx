"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/player/QRScanner";
import { RegistrationOverlay } from "@/components/shared/RegistrationOverlay";
import { ConfirmRegistrationModal } from "@/components/shared/ConfirmRegistrationModal";
import { TeamDnD } from "@/components/tournament/TeamDnD";
import { useSocket } from "@/hooks/useSocket";
import {
  Settings, Swords, Trophy, Users, UserPlus, Shield,
  ExternalLink, QrCode, Search, Check, X, Loader2,
  Gamepad2, Calendar, DollarSign, MapPin, User,
  UserCheck, Camera, Plus, Info, Filter,
} from "lucide-react";

type Player = { id: string; username: string; avatarUrl: string | null };
type Team = {
  id: string; name: string; captainId: string;
  captain: { id: string; username: string };
  _count: { members: number };
  members: { id: string; userId: string; user: { id: string; username: string }; status: string }[];
};

type Props = {
  tournament: any;
  players: Player[];
  organizers: { id: string; username: string; role: string }[];
  teams: Team[];
  freeAgents: Player[];
  isAdmin: boolean;
};

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full bg-muted/20 text-muted hover:text-gold hover:bg-gold/10 transition-colors flex items-center justify-center"
      >
        <Info className="w-2.5 h-2.5" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-surface border border-border rounded-xl text-[10px] text-muted shadow-xl z-20">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-r border-b border-border rotate-45 -mt-1" />
        </div>
      )}
    </span>
  );
}

export function ManageTournamentClient({ tournament, players, organizers, teams, freeAgents, isAdmin }: Props) {
  const isIndividual = tournament.isTeamBased === false;
  const router = useRouter();
  const [tab, setTab] = useState<"alta" | "equipos" | "general" | "bracket" | "prizes" | "participants">("alta");
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  // Overlay
  const [overlay, setOverlay] = useState<{ type: "registered" | "already" | "captain" | "error"; username: string; teamName?: string } | null>(null);

  // Alta - Registration
  const [playerSearch, setPlayerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [registerMode, setRegisterMode] = useState<"free" | "captain">("free");
  const [captainTeamName, setCaptainTeamName] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [registeredSearch, setRegisteredSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; username: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Status
  const [status, setStatus] = useState(tournament.status);

  // Organizer assignment
  const [selectedOrgId, setSelectedOrgId] = useState("");

  // Bracket team
  const [selectedTeamId, setSelectedTeamId] = useState("");

  // Prizes
  const [prizeName, setPrizeName] = useState("");
  const [prizeValue, setPrizeValue] = useState("");
  const [prizePosition, setPrizePosition] = useState("");

  const showOverlay = useCallback((type: "registered" | "already" | "captain" | "error", username: string, teamName?: string) => {
    setOverlay({ type, username, teamName });
  }, []);

  const showFeedback = useCallback((type: "ok" | "error", msg: string) => {
    // Feedback now uses overlay instead
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredPlayers = players.filter((p) =>
    p.username.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const filteredRegistered = players.filter((p) =>
    p.username.toLowerCase().includes(registeredSearch.toLowerCase())
  );

  const registerPlayer = async (userId: string, teamNameArg?: string) => {
    setLoading(true);
    const pName = players.find((p) => p.id === userId)?.username || "Jugador";

    // Individual tournament: just register, no teams
    if (isIndividual) {
      const res = await fetch(`/api/tournaments/${tournament.id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, registeredBy: "admin" }),
      });
      if (res.ok) {
        showOverlay("registered", pName);
        if (socket) socket.emit("notification:send", { userId, message: `Has sido registrado en ${tournament.name}` });
      } else if (res.status === 409) {
        showOverlay("already", pName);
      } else {
        const data = await res.json();
        showOverlay("error", data.error || "Error al registrar");
      }
      setLoading(false);
      setShowDropdown(false);
      setConfirmTarget(null);
      router.refresh();
      return;
    }

    // Team tournament: handle captain/free agent
    if (registerMode === "captain" && teamNameArg) {
      const teamRes = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamNameArg, captainId: userId }),
      });
      if (!teamRes.ok) {
        showOverlay("error", "Error al crear el equipo");
        setLoading(false);
        return;
      }
      const team = await teamRes.json();
      await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      showOverlay("captain", pName, teamNameArg);
    }

    const res = await fetch(`/api/tournaments/${tournament.id}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, registeredBy: "admin" }),
    });

    if (res.ok) {
      if (registerMode !== "captain") showOverlay("registered", pName);
      if (socket) socket.emit("notification:send", { userId, message: `Has sido registrado en ${tournament.name}` });
      setPlayerSearch("");
    } else if (res.status === 409) {
      showOverlay("already", pName);
    } else {
      const data = await res.json();
      showOverlay("error", data.error || "Error al registrar");
    }
    setLoading(false);
    setShowDropdown(false);
    setConfirmTarget(null);
    router.refresh();
  };

  const handleQRScan = async (code: string) => {
    setShowScanner(false);
    setLoading(true);
    setPlayerSearch(code);
    const userRes = await fetch(`/api/users?q=${encodeURIComponent(code)}`);
    const users = await userRes.json();
    if (users.length > 0) {
      const user = users[0];
      setConfirmTarget({ id: user.id, username: user.username });
    } else {
      showOverlay("error", "Código QR no válido. Busca por username.");
    }
    setLoading(false);
  };

  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    setStatusConfirm(null);
    await fetch(`/api/tournaments/${tournament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus);
    setLoading(false);
    router.refresh();
  };

  const addOrganizer = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    await fetch(`/api/tournaments/${tournament.id}/organizers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedOrgId }),
    });
    setSelectedOrgId("");
    setLoading(false);
    router.refresh();
  };

  const addTeamToTournament = async () => {
    if (!selectedTeamId) return;
    setLoading(true);
    await fetch(`/api/tournaments/${tournament.id}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId }),
    });
    setSelectedTeamId("");
    setLoading(false);
    router.refresh();
  };

  const generateBracket = async () => {
    setLoading(true);
    const res = await fetch(`/api/tournaments/${tournament.id}/rounds`, { method: "POST" });
    setLoading(false);
    router.refresh();
    if (!res.ok) {
      const data = await res.json();
      showOverlay("error", data.error || "Error al generar bracket");
    }
  };

  const createPrize = async () => {
    if (!prizeName || !prizeValue) return;
    setLoading(true);
    await fetch(`/api/tournaments/${tournament.id}/prizes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: prizeName,
        value: prizeValue,
        position: prizePosition ? parseInt(prizePosition) : null,
        type: prizePosition ? "POSITION" : "PARTICIPATION",
      }),
    });
    setPrizeName(""); setPrizeValue(""); setPrizePosition("");
    setLoading(false);
    router.refresh();
  };

  const statusFlow = [
    { key: "DRAFT", label: "Borrador", desc: "Solo tú puedes verlo" },
    { key: "OPEN_REGISTRATION", label: "Registro abierto", desc: "Pueden inscribirse" },
    { key: "CLOSED", label: "Registro cerrado", desc: "Ya no se aceptan más" },
    { key: "IN_PROGRESS", label: "En curso", desc: "Torneo en juego" },
    { key: "COMPLETED", label: "Finalizado", desc: "Torneo terminado" },
  ];

  const currentIdx = statusFlow.findIndex((s) => s.key === status);
  const registeredTeamIds = tournament.tournamentTeams?.map((tt: any) => tt.teamId) || [];
  const availableTeams = teams.filter((t: any) => !registeredTeamIds.includes(t.id));

  const tabs = [
    { id: "alta" as const, label: "Alta", icon: UserPlus, desc: "Registrar" },
    ...(tournament.isTeamBased !== false ? [{ id: "equipos" as const, label: "Equipos", icon: Users, desc: "Armar equipos" }] : []),
    { id: "general" as const, label: "General", icon: Settings, desc: "Estado" },
    { id: "bracket" as const, label: "Bracket", icon: Swords, desc: "Bracket" },
    { id: "prizes" as const, label: "Premios", icon: Trophy, desc: "Premios" },
    { id: "participants" as const, label: "Participantes", icon: Users, desc: "Equipos" },
  ].filter(Boolean);

  return (
    <div>
      {/* Tabs - compact */}
      <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1 border border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === t.id
                ? "bg-gold text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ═══════ ALTA ═══════ */}
      {tab === "alta" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Registration form */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-gold">Registrar participante</h2>
              <InfoTip text={isIndividual ? "Escribe el username o escanea el QR para registrar al jugador directamente." : "Escribe el username o escanea el QR. Puedes registrarlo como agente libre o como capitán de un nuevo equipo."} />
            </div>

            {!isIndividual && (
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => setRegisterMode("free")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  registerMode === "free"
                    ? "bg-gold text-background"
                    : "bg-background text-muted border border-border hover:border-gold/30"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Agente libre
              </button>
              <button
                onClick={() => setRegisterMode("captain")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  registerMode === "captain"
                    ? "bg-gold text-background"
                    : "bg-background text-muted border border-border hover:border-gold/30"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Capitán
              </button>
            </div>
            )}

            <div className="relative" ref={searchRef}>
              <div className="flex gap-1.5">
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Username..."
                    value={playerSearch}
                    onChange={(e) => { setPlayerSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-8 pr-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
                  />
                </div>
                <Button onClick={() => setShowScanner(true)} variant="outline" size="sm" title="Escanear QR">
                  <Camera className="w-3.5 h-3.5" />
                </Button>
              </div>

              {showDropdown && playerSearch.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-2 text-xs text-muted text-center">Sin resultados</div>
                  ) : (
                    filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setConfirmTarget({ id: p.id, username: p.username });
                          setShowDropdown(false);
                        }}
                        disabled={loading}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold">
                          {p.username[0].toUpperCase()}
                        </div>
                        <span className="flex-1 text-xs">{p.username}</span>
                        {registerMode === "captain" ? (
                          <Shield className="w-3 h-3 text-gold shrink-0" />
                        ) : (
                          <User className="w-3 h-3 text-muted shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Right: Registered players list */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-bold text-gold">Registrados</h2>
              <span className="text-xs text-muted">({players.length})</span>
              <InfoTip text="Lista de todos los jugadores dados de alta en el sistema. Usa el buscador para filtrar." />
            </div>

            <div className="relative mb-2">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
              <input
                type="text"
                placeholder="Buscar en registrados..."
                value={registeredSearch}
                onChange={(e) => setRegisteredSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder-muted focus:outline-none focus:border-gold"
              />
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {filteredRegistered.length === 0 ? (
                <div className="text-center py-6 text-muted text-xs">
                  <Users className="w-6 h-6 mx-auto mb-1 opacity-30" />
                  <p>Sin resultados</p>
                </div>
              ) : (
                filteredRegistered.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-background transition-colors">
                    <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                      {p.username[0].toUpperCase()}
                    </div>
                    <span className="text-xs">{p.username}</span>
                    <UserCheck className="w-3 h-3 text-green-400 ml-auto shrink-0" />
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════ EQUIPOS ═══════ */}
      {tab === "equipos" && (
        <TeamDnD
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          teams={teams}
          freeAgents={freeAgents}
          isIndividual={!tournament.isTeamBased}
        />
      )}

      {/* ═══════ GENERAL ═══════ */}
      {tab === "general" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-bold text-gold">Estado del torneo</h2>
              <InfoTip text="Cada estado define lo que pueden hacer los jugadores. 'Registro abierto' permite inscripciones." />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {statusFlow.map((s, i) => {
                const isActive = i <= currentIdx;
                const isCurrent = status === s.key;
                return (
                <button
                  key={s.key}
                  onClick={() => setStatusConfirm(s.key)}
                  disabled={loading || isCurrent}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? "bg-gold text-background border-gold cursor-default"
                      : isActive
                        ? "bg-background text-foreground border-gold/30 cursor-pointer hover:bg-gold/5"
                        : "bg-background text-muted border-border opacity-40 cursor-not-allowed"
                  }`}
                >
                  <p className="font-bold text-[10px] leading-tight">{s.label}</p>
                  <p className="text-[8px] mt-0.5 opacity-70">{s.desc}</p>
                </button>
                );
              })}
            </div>
          </Card>
          <EditTournamentForm tournament={tournament} />
        </div>
      )}

      {/* ═══════ BRACKET ═══════ */}
      {tab === "bracket" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-base font-bold text-gold mb-3">Bracket</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-background rounded-lg p-2 border border-border">
                <p className="text-muted text-[10px]">Equipos</p>
                <p className="font-bold text-sm">{registeredTeamIds.length} / {tournament.maxTeams}</p>
              </div>
              <div className="bg-background rounded-lg p-2 border border-border">
                <p className="text-muted text-[10px]">Tipo</p>
                <p className="font-bold text-sm">{tournament.bracketType.replace(/_/g, " ")}</p>
              </div>
            </div>
            <div className="flex gap-2">
                  <Button size="sm" onClick={generateBracket} disabled={loading || registeredTeamIds.length < 2}>
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {loading ? "Generando..." : "Generar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/tournaments/${tournament.id}/bracket`)}>
                <ExternalLink className="w-3 h-3" /> Ver
              </Button>
            </div>
            {registeredTeamIds.length < 2 && (
              <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[10px] text-yellow-400">
                Min 2 equipos. Crea desde "Alta" como Capitán.
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-bold text-gold mb-3">Agregar equipo</h2>
            <div className="flex gap-2">
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex-1 px-2 py-2 bg-background border border-border rounded-lg text-xs">
                <option value="">Seleccionar...</option>
                {availableTeams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t._count.members})</option>
                ))}
              </select>
              <Button size="sm" onClick={addTeamToTournament} disabled={!selectedTeamId || loading}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════ PREMIOS ═══════ */}
      {tab === "prizes" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-base font-bold text-gold mb-3">Crear premio</h2>
            <div className="space-y-2">
              <input placeholder="Nombre" value={prizeName} onChange={(e) => setPrizeName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              <input placeholder="Valor" value={prizeValue} onChange={(e) => setPrizeValue(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              <input placeholder="Posición (1,2,3...)" value={prizePosition} onChange={(e) => setPrizePosition(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              <Button size="sm" onClick={createPrize} disabled={loading || !prizeName || !prizeValue} className="w-full">
                <Plus className="w-3.5 h-3.5" /> Crear
              </Button>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="text-base font-bold text-gold mb-3">Premios</h2>
            {tournament.prizes?.length > 0 ? (
              <div className="space-y-1">
                {tournament.prizes.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-xs">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-muted">{p.position ? `#${p.position}` : "Participación"}</p>
                    </div>
                    <span className="text-gold font-bold">{p.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs">Sin premios</p>
            )}
          </Card>
        </div>
      )}

      {/* ═══════ PARTICIPANTES ═══════ */}
      {tab === "participants" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-base font-bold text-gold mb-3">Equipos ({registeredTeamIds.length})</h2>
            {tournament.tournamentTeams?.length > 0 ? (
              <div className="space-y-2">
                {tournament.tournamentTeams.map((tt: any) => (
                  <div key={tt.id} className="bg-background border border-border rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs">{tt.team.name}</h3>
                      <span className="text-[10px] text-muted">{tt.team.members?.length || 0}/5</span>
                    </div>
                    <p className="text-[10px] text-muted"><Shield className="w-2.5 h-2.5 inline" /> {tt.team.captain?.username}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tt.team.members?.map((m: any) => (
                        <span key={m.userId} className="px-1.5 py-0.5 bg-gold/10 text-gold rounded text-[9px]">{m.user?.username}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted text-xs">
                <Users className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <p>Sin equipos</p>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-base font-bold text-gold mb-3">Organizadores</h2>
              <div className="space-y-1 mb-3">
                {tournament.organizers?.map((o: any) => (
                  <div key={o.id} className="flex items-center gap-2 py-1">
                    <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold">{o.user.username[0].toUpperCase()}</div>
                    <span className="text-xs">{o.user.username}</span>
                  </div>
                ))}
                {tournament.organizers?.length === 0 && <p className="text-muted text-xs">Sin organizadores</p>}
              </div>
              {isAdmin && (
                <div className="pt-3 border-t border-border">
                  <div className="flex gap-2">
                    <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded-lg text-xs">
                      <option value="">Asignar...</option>
                      {organizers.filter((o) => !tournament.organizers?.some((to: any) => to.user.id === o.id)).map((o) => (
                        <option key={o.id} value={o.id}>{o.username}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={addOrganizer} disabled={!selectedOrgId || loading}>
                      <UserPlus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* QR Scanner */}
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      {/* Registration Overlay */}
      {overlay && (
        <RegistrationOverlay
          type={overlay.type}
          username={overlay.username}
          teamName={overlay.teamName}
          onClose={() => setOverlay(null)}
        />
      )}

      {/* Status Confirm Modal */}
      {statusConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Settings className="w-7 h-7 text-gold" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Cambiar estado</h2>
            <p className="text-sm text-muted mb-2">
              De <strong className="text-foreground">{statusFlow.find((s) => s.key === status)?.label}</strong> a <strong className="text-gold">{statusFlow.find((s) => s.key === statusConfirm)?.label}</strong>
            </p>
            <p className="text-xs text-muted mb-6">
              {statusFlow.find((s) => s.key === statusConfirm)?.desc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => updateStatus(statusConfirm)}
                className="flex-1 py-3 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover"
              >
                {loading ? "..." : "CONFIRMAR"}
              </button>
              <button
                onClick={() => setStatusConfirm(null)}
                className="flex-1 py-3 border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Registration Modal */}
      {confirmTarget && (
        <ConfirmRegistrationModal
          username={confirmTarget.username}
          mode={registerMode}
          isIndividual={isIndividual}
          onConfirm={(teamName) => registerPlayer(confirmTarget.id, teamName)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

function EditTournamentForm({ tournament }: { tournament: any }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: tournament.name,
    description: tournament.description || "",
    maxTeams: tournament.maxTeams,
    entryFee: tournament.entryFee ? tournament.entryFee.toString() : "",
    location: tournament.location || "",
    eventDate: tournament.eventDate ? tournament.eventDate.slice(0, 16) : "",
  });

  if (!editing) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gold">Información del torneo</h2>
          <button onClick={() => setEditing(true)} className="text-[10px] text-gold hover:underline">Editar</button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-muted">Juego:</span> {tournament.game.replace(/_/g, " ")}</div>
          <div><span className="text-muted">Cupos:</span> {tournament.maxTeams}</div>
          <div><span className="text-muted">Cuota:</span> {tournament.entryFee ? `$${tournament.entryFee}` : "Gratis"}</div>
          <div><span className="text-muted">Fecha:</span> {new Date(tournament.eventDate).toLocaleDateString()}</div>
          <div><span className="text-muted">Ubicación:</span> {tournament.location || "---"}</div>
          <div><span className="text-muted">Bracket:</span> {tournament.bracketType.replace(/_/g, " ")}</div>
        </div>
      </Card>
    );
  }

  const save = async () => {
    setLoading(true);
    await fetch(`/api/tournaments/${tournament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, description: form.description || undefined,
        maxTeams: parseInt(form.maxTeams),
        entryFee: form.entryFee ? parseFloat(form.entryFee) : null,
        location: form.location || null,
        eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  };

  return (
    <Card className="p-4">
      <h2 className="text-base font-bold text-gold mb-3">Editar torneo</h2>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs" placeholder="Nombre" />
        <input value={form.maxTeams} onChange={(e) => setForm((f) => ({ ...f, maxTeams: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs" type="number" />
        <input value={form.entryFee} onChange={(e) => setForm((f) => ({ ...f, entryFee: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs" type="number" />
        <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs" />
        <input value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs" type="datetime-local" />
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs min-h-[40px]" />
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={save} disabled={loading}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}
