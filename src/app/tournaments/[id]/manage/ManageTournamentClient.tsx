"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/player/QRScanner";
import { RegistrationOverlay } from "@/components/shared/RegistrationOverlay";
import { ConfirmRegistrationModal } from "@/components/shared/ConfirmRegistrationModal";
import { TeamDnD } from "@/components/tournament/TeamDnD";
import { showToast, ToastContainer } from "@/components/shared/Toast";
import { useSocket } from "@/hooks/useSocket";
import {
  Settings, Swords, Trophy, Users, UserPlus, Shield,
  ExternalLink, QrCode, Search, Check, X, Loader2,
  Gamepad2, Calendar, DollarSign, MapPin, User,
  UserCheck, Camera, Plus, Info, Filter, Trash2,
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
  allPlayers: Player[];
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

export function ManageTournamentClient({ tournament, players, allPlayers, organizers, teams, freeAgents, isAdmin }: Props) {
  const isIndividual = tournament.isTeamBased === false;
  const membersInTeam = new Set(teams.flatMap((t: any) => t.members.map((m: any) => m.userId)));
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
  const [registering, setRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  // Team registration
  const [teamRegSearch, setTeamRegSearch] = useState("");
  const [teamRegId, setTeamRegId] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [teamRegMsg, setTeamRegMsg] = useState("");
  // filteredTeams moved below (after availableTeams)

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

  const registeredIds = new Set(players.map(p => p.id));
  const filteredPlayers = allPlayers.filter((p) =>
    p.username.toLowerCase().includes(playerSearch.toLowerCase()) && !registeredIds.has(p.id)
  );

  const filteredRegistered = players.filter((p) =>
    p.username.toLowerCase().includes(registeredSearch.toLowerCase())
  );

  const registerPlayer = async (userId: string, teamNameArg?: string) => {
    setRegistering(true);
    const pName = allPlayers.find((p) => p.id === userId)?.username || "Jugador";

    const doRegister = async () => {
      if (isIndividual) {
        return await fetch(`/api/tournaments/${tournament.id}/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, registeredBy: "admin" }),
        });
      }
      if (registerMode === "captain" && teamNameArg) {
        const teamRes = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: teamNameArg, captainId: userId }),
        });
        if (!teamRes.ok) { showOverlay("error", "Error al crear el equipo"); return null; }
        const team = await teamRes.json();
        await fetch(`/api/tournaments/${tournament.id}/teams`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: team.id }),
        });
        showOverlay("captain", pName, teamNameArg);
      }
      return await fetch(`/api/tournaments/${tournament.id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, registeredBy: "admin" }),
      });
    };

    const res = await doRegister();
    if (res === null) { setRegistering(false); return; }
    if (res.ok) {
      if (registerMode !== "captain") showOverlay("registered", pName);
      if (socket) socket.emit("notification:send", { userId, message: `Has sido registrado en ${tournament.name}` });
      setPlayerSearch("");
      setRegisterSuccess(userId);
      setTimeout(() => setRegisterSuccess(null), 1500);
    } else if (res.status === 409) {
      showOverlay("already", pName);
    } else {
      const data = await res.json();
      showOverlay("error", data.error || "Error al registrar");
    }
    setRegistering(false);
    setShowDropdown(false);
    setConfirmTarget(null);
    router.refresh();
  };

  // Register an entire team (team + all members)
  const registerTeam = async () => {
    if (!teamRegId) return;
    setRegistering(true);
    setTeamRegMsg("");
    try {
      const selectedTeam = teams.find((t: any) => t.id === teamRegId);
      if (!selectedTeam) { setTeamRegMsg("Equipo no encontrado"); setRegistering(false); return; }

      // 1. Create TournamentTeam record
      const ttRes = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam.id }),
      });
      if (!ttRes.ok) { const e = await ttRes.json(); setTeamRegMsg(e.error || "Error al registrar equipo"); setRegistering(false); return; }

      // 2. Register each active member
      const activeMembers = selectedTeam.members?.filter((m: any) => m.status === "ACTIVE") || [];
      let registered = 0;
      for (const member of activeMembers) {
        const regRes = await fetch(`/api/tournaments/${tournament.id}/registrations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: member.userId || member.user?.id, teamId: selectedTeam.id }),
        });
        if (regRes.ok) registered++;
      }

      setTeamRegMsg(`✓ ${selectedTeam.name} registrado (${registered} miembros)`);
      setTeamRegSearch("");
      setTeamRegId("");
      setShowTeamDropdown(false);
    } catch { setTeamRegMsg("Error de conexión"); }
    setRegistering(false);
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
    { key: "DRAFT", label: "Planeación", desc: "Configuración inicial" },
    { key: "OPEN_REGISTRATION", label: "Registro abierto", desc: "Pueden inscribirse" },
    { key: "CLOSED", label: "Registro cerrado", desc: "Ya no se aceptan más" },
    { key: "IN_PROGRESS", label: "En curso", desc: "Torneo en juego" },
    { key: "COMPLETED", label: "Finalizado", desc: "Torneo terminado" },
  ];

  const currentIdx = statusFlow.findIndex((s) => s.key === status);
  const registeredTeamIds = tournament.tournamentTeams?.map((tt: any) => tt.teamId) || [];
  const availableTeams = teams.filter((t: any) => !registeredTeamIds.includes(t.id));
  const filteredTeams = availableTeams.filter((t: any) =>
    t.name.toLowerCase().includes(teamRegSearch.toLowerCase())
  );

  const tabs = [
    { id: "alta" as const, label: "Alta", icon: UserPlus, desc: "Registrar" },
    ...(tournament.isTeamBased !== false ? [{ id: "equipos" as const, label: "Equipos", icon: Users, desc: "Armar equipos" }] : []),
    { id: "bracket" as const, label: "Bracket", icon: Swords, desc: "Bracket" },
    { id: "general" as const, label: "Estado", icon: Settings, desc: "Estado" },
    { id: "prizes" as const, label: "Premios", icon: Trophy, desc: "Premios" },
    { id: "participants" as const, label: "Participantes", icon: Users, desc: "Info" },
  ].filter(Boolean);

  return (
    <div>
      {/* Tabs - compact */}
      <div className="flex gap-1 mb-3 bg-surface rounded-xl p-1 border border-border overflow-x-auto">
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

      {/* ── STATUS STEPPER (always visible) ── */}
      <div className="mb-5 p-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center justify-between">
          {statusFlow.map((s, i) => {
            const isActive = i <= currentIdx;
            const isCurrent = status === s.key;
            const isLast = i === statusFlow.length - 1;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <button
                  onClick={() => setStatusConfirm(s.key)}
                  disabled={loading || isCurrent}
                  className="flex flex-col items-center gap-1 transition-all group"
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 transition-all ${
                    isCurrent
                      ? "bg-gold text-background border-gold shadow-lg shadow-gold/30 scale-110"
                      : isActive
                        ? "bg-green-500/20 text-green-400 border-green-400"
                        : "bg-background text-muted border-border group-hover:border-gold/30"
                  }`}>
                    {isCurrent ? "●" : isActive ? "✓" : i + 1}
                  </div>
                  <span className={`text-[8px] sm:text-[10px] font-bold text-center leading-tight max-w-[64px] sm:max-w-[80px] ${
                    isCurrent ? "text-gold" : isActive ? "text-green-400" : "text-muted"
                  }`}>
                    {s.label}
                  </span>
                </button>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full ${
                    i < currentIdx ? "bg-green-400" : i === currentIdx ? "bg-gold" : "bg-border"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ ALTA ═══════ */}
      {tab === "alta" && (
        <><div className="grid gap-4 md:grid-cols-2">
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

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-3 text-xs text-muted text-center">Sin resultados. Usa el QR.</div>
                  ) : (
                    filteredPlayers.map((p) => {
                      const isProcessing = registering;
                      const isSuccess = registerSuccess === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (!isProcessing) {
                              setConfirmTarget({ id: p.id, username: p.username });
                              setShowDropdown(false);
                            }
                          }}
                          disabled={isProcessing}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-background transition-colors text-left ${
                            isProcessing ? "opacity-50" : ""
                          } ${isSuccess ? "bg-green-500/10" : ""}`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isSuccess ? "bg-green-500 text-white" : "bg-gold/10 text-gold"
                          }`}>
                            {isSuccess ? <Check className="w-3.5 h-3.5" /> : p.username[0].toUpperCase()}
                          </div>
                          <span className="flex-1 text-xs font-medium">{p.username}</span>
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted shrink-0" />
                          ) : isSuccess ? (
                            <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          ) : registerMode === "captain" ? (
                            <Shield className="w-3 h-3 text-gold shrink-0" />
                          ) : (
                            <User className="w-3 h-3 text-muted shrink-0" />
                          )}
                        </button>
                      );
                    })
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
                  filteredRegistered.map((p) => {
                    const isFree = !membersInTeam.has(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-background transition-colors">
                        <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                          {p.username[0].toUpperCase()}
                        </div>
                        <span className="text-xs">{p.username}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {isFree && !isIndividual && (
                            <button
                              onClick={async () => {
                                const name = prompt(`Nombre del equipo para ${p.username}:`);
                                if (!name?.trim()) return;
                                const teamRes = await fetch("/api/teams", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: name.trim(), captainId: p.id }),
                                });
                                if (!teamRes.ok) return;
                                const team = await teamRes.json();
                                await fetch(`/api/tournaments/${tournament.id}/teams`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ teamId: team.id }),
                                });
                                router.refresh();
                              }}
                              className="px-2 py-0.5 bg-gold/10 text-gold rounded text-[9px] font-bold hover:bg-gold/20 transition-colors whitespace-nowrap"
                            >
                              +Equipo
                            </button>
                          )}
                          <UserCheck className={`w-3 h-3 shrink-0 ${isFree ? "text-muted" : "text-green-400"}`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          </Card>
        </div>

        {/* Team registration */}
        {!isIndividual && (
          <Card className="p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-gold" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gold">Registrar equipo completo</h2>
                <p className="text-[10px] text-muted">Registra el equipo y todos sus miembros activos de una vez</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input type="text" placeholder="Buscar equipo..."
                  value={teamRegSearch}
                  onChange={(e) => { setTeamRegSearch(e.target.value); setShowTeamDropdown(true); }}
                  onFocus={() => setShowTeamDropdown(true)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
                  autoComplete="off" />
                {showTeamDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                    {filteredTeams.length === 0 ? (
                      <div className="p-3 text-xs text-muted text-center">Sin resultados</div>
                    ) : (
                      filteredTeams.map((t: any) => {
                        const mc = t._count?.members || t.members?.filter((m: any)=>m.status==="ACTIVE").length || 0;
                        return (
                          <button key={t.id}
                            onClick={() => { setTeamRegSearch(t.name); setTeamRegId(t.id); setShowTeamDropdown(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-background transition-colors">
                            <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">{t.name[0].toUpperCase()}</div>
                            <span className="font-medium">{t.name}</span>
                            <span className="text-muted ml-auto">{mc} miembros</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <Button onClick={registerTeam} disabled={!teamRegId || registering} size="sm">
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {registering ? "..." : "Registrar"}
              </Button>
            </div>
            {teamRegMsg && (
              <p className={`text-xs mt-2 ${teamRegMsg.startsWith("✓") ? "text-green-400" : "text-red"}`}>{teamRegMsg}</p>
            )}
          </Card>
        )}
        </>)}

      {/* ═══════ EQUIPOS ═══════ */}
      {tab === "equipos" && (
        <TeamDnD
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          teams={teams}
          freeAgents={freeAgents}
          isIndividual={isIndividual}
          tournamentTeams={tournament.tournamentTeams || []}
          allPlayers={players}
          teamSize={tournament.teamSize || 5}
        />
      )}

      {/* ═══════ GENERAL ═══════ */}
      {tab === "general" && (
        <div className="space-y-4">
          <EditTournamentForm tournament={tournament} />
        </div>
      )}

      {/* ═══════ BRACKET ═══════ */}
      {tab === "bracket" && (
        <BracketBuilder
          tournamentId={tournament.id}
          tournamentStatus={status}
          rounds={tournament.rounds || []}
          players={players}
          teams={teams}
          isIndividual={isIndividual}
          canEdit={true}
          maxSlots={tournament.maxTeams}
          tournamentTeams={tournament.tournamentTeams || []}
        />
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

function BracketBuilder({
  tournamentId, tournamentStatus, rounds, players, teams, isIndividual, canEdit, maxSlots, tournamentTeams,
}: {
  tournamentId: string; tournamentStatus: string; rounds: any[];
  players: { id: string; username: string }[];
  teams: any[]; isIndividual: boolean; canEdit: boolean; maxSlots: number;
  tournamentTeams: { teamId: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [markSuccess, setMarkSuccess] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const lastRoundRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [schedulingMatch, setSchedulingMatch] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  // Winner confirmation dialog
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [winnerConfirm, setWinnerConfirm] = useState<{
    matchId: string; winnerId: string; roundId: string; winnerName: string; loserName: string;
  } | null>(null);

  const tournamentTeamIds = new Set((tournamentTeams || []).map((tt: any) => tt.teamId));
  const allParticipants = isIndividual
    ? players.map((p) => ({ id: p.id, name: p.username }))
    : teams.filter((t: any) => tournamentTeamIds.has(t.id)).map((t: any) => ({ id: t.id, name: t.name }));

  const assignedIds = new Set<string>();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.team1Id) assignedIds.add(match.team1Id);
      if (match.team2Id) assignedIds.add(match.team2Id);
    }
  }

  const initBracket = async () => {
    setLoading(true); setStatusMsg("");
    const count = allParticipants.length;
    if (count < 2) { setStatusMsg("Se necesitan al menos 2 participantes"); setLoading(false); return; }
    let n = 2; while (n < count) n *= 2;
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket/init`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numSlots: n }),
    });
    setStatusMsg(res.ok ? "Bracket listo. Asigna los participantes a cada pareja." : (await res.json()).error || "Error");
    setLoading(false); router.refresh();
  };

  const assignSlot = async (matchId: string, slot: string, pid: string) => {
    await fetch(`/api/tournaments/${tournamentId}/bracket/assign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, slot, participantId: pid }),
    });
    router.refresh();
  };

  const removeSlot = async (matchId: string, slot: string) => {
    await fetch(`/api/tournaments/${tournamentId}/bracket/assign`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, slot }),
    });
    router.refresh();
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const scheduleMatch = async (matchId: string, roundId: string) => {
    if (!scheduleDate) return;
    showToast("Programando partida...", "loading");
    await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: new Date(scheduleDate).toISOString() }),
    });
    showToast("Partida programada", "success");
    setSchedulingMatch(null);
    setScheduleDate("");
    router.refresh();
  };

  const withToast = async (key: string, action: () => Promise<any>, successMsg: string) => {
    setActionLoading(key);
    showToast("Procesando...", "loading");
    try {
      await action();
      showToast(successMsg, "success");
    } catch {
      showToast("Error al procesar", "error");
    }
    setActionLoading(null);
    router.refresh();
  };

  const deleteMatch = async (matchId: string, roundId: string) => {
    await withToast(`del-match-${matchId}`, async () => {
      await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, { method: "DELETE" });
    }, "Enfrentamiento eliminado");
  };

  const resolveName = (id: string) => allParticipants.find((p) => p.id === id)?.name || "---";

  // Determine winner side (works for team and individual tournaments)
  const getWinnerSide = (match: any): "team1" | "team2" | null => {
    if (match.winnerId) return match.winnerId === match.team1Id ? "team1" : "team2";
    if ((match.score1 ?? 0) > (match.score2 ?? 0)) return "team1";
    if ((match.score2 ?? 0) > (match.score1 ?? 0)) return "team2";
    return null;
  };

  // Open confirmation dialog before marking winner
  const confirmMarkWinner = (matchId: string, winnerId: string, roundId: string) => {
    const currentMatch = rounds.find((r: any) => r.id === roundId)?.matches.find((m: any) => m.id === matchId);
    if (!currentMatch) return;
    const winnerName = resolveName(winnerId);
    const loserId = currentMatch.team1Id === winnerId ? currentMatch.team2Id : currentMatch.team1Id;
    const loserName = resolveName(loserId);
    setWinnerConfirm({ matchId, winnerId, roundId, winnerName, loserName });
    confirmDialogRef.current?.showModal();
  };

  const executeMarkWinner = async () => {
    if (!winnerConfirm) return;
    const { matchId, winnerId, roundId } = winnerConfirm;
    setWinnerConfirm(null);
    setMarking(matchId);

    const currentMatch = rounds.find((r: any) => r.id === roundId)?.matches.find((m: any) => m.id === matchId);
    const isTeam1Winner = currentMatch?.team1Id === winnerId;
    const score1 = isTeam1Winner ? 1 : 0;
    const score2 = isTeam1Winner ? 0 : 1;

    const res = await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId, score1, score2, status: "COMPLETED" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error desconocido" }));
      setStatusMsg(err.error || "Error al marcar ganador");
      setMarking(null);
      return;
    }

    // Auto-advance
    const currentRound = rounds.find((r: any) => r.id === roundId);
    if (currentRound) {
      const nextRoundNum = currentRound.roundNumber + 1;
      const nextRound = rounds.find((r: any) => r.roundNumber === nextRoundNum);
      if (nextRound) {
        const emptyMatch = nextRound.matches.find((m: any) => !m.team1Id || !m.team2Id);
        if (emptyMatch) {
          const slot = emptyMatch.team1Id ? "team2" : "team1";
          await fetch(`/api/tournaments/${tournamentId}/bracket/assign`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId: emptyMatch.id, slot, participantId: winnerId }),
          });
        }
      } else {
        await fetch(`/api/tournaments/${tournamentId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
        setStatusMsg(`CAMPEÓN: ${resolveName(winnerId)} ha ganado el torneo!`);
      }
    }

    setMarkSuccess(matchId);
    setTimeout(() => { setMarkSuccess(null); setMarking(null); }, 1500);
    router.refresh();
  };

  // Revoke a winner (set match back to PENDING)
  const revokeWinner = async (matchId: string, roundId: string) => {
    setMarking(matchId);
    await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId: null, status: "PENDING", score1: null, score2: null }),
    });
    setMarking(null);
    router.refresh();
  };

  // 3-second delete confirm
  const handleDeleteClick = (roundId: string) => {
    if (deleteConfirm === roundId) {
      withToast(`del-round-${roundId}`, async () => {
        await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}`, { method: "DELETE" });
      }, "Ronda eliminada");
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(roundId);
      setTimeout(() => setDeleteConfirm((prev) => prev === roundId ? null : prev), 3000);
    }
  };

  const addRound = async () => {
    const lastRound = rounds[rounds.length - 1];
    const prevMatchCount = lastRound?.matches?.length || 1;
    const matchCount = Math.max(1, Math.ceil(prevMatchCount / 2));
    showToast("Creando ronda...", "loading");
    await fetch(`/api/tournaments/${tournamentId}/rounds/create`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchCount }),
    });
    showToast("Ronda creada", "success");
    router.refresh();
    setTimeout(() => {
      lastRoundRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  };

  const addMatchToRound = async (roundId: string) => {
    const round = rounds.find((r: any) => r.id === roundId);
    const nextPos = round?.matches?.length || 0;
    await withToast(`add-match-${roundId}`, async () => {
      await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketPosition: nextPos }),
      });
    }, "Combate agregado");
  };

  const hasRounds = rounds.length > 0;
  const label = isIndividual ? "Jugadores" : "Equipos";

  return (
    <div className="space-y-4">
      {statusMsg && (
        <div className="px-4 py-3 bg-gold/10 border border-gold/30 rounded-xl text-sm text-gold flex items-center gap-2">
          <Check className="w-5 h-5" /> {statusMsg}
        </div>
      )}

      {!hasRounds && (
        <Card className="p-8 text-center">
          <Swords className="w-12 h-12 text-muted mx-auto mb-4 opacity-30" />
          <p className="text-muted text-base font-medium mb-4">
            {allParticipants.length < 2
              ? `Se necesitan al menos 2 participantes (actual: ${allParticipants.length})`
              : `Inicializa el bracket para comenzar a posicionar a los ${allParticipants.length} participantes`}
          </p>
          {canEdit && (
            <Button onClick={initBracket} disabled={loading || allParticipants.length < 2} size="lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" />}
              {loading ? "Creando..." : "Inicializar Bracket"}
            </Button>
          )}
        </Card>
      )}

      {hasRounds && (
        <>
          {/* Pool - compact */}
          {canEdit && allParticipants.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-muted flex-wrap">
              <Users className="w-3.5 h-3.5 text-gold shrink-0" />
              <span className="font-medium">{allParticipants.filter((p) => !assignedIds.has(p.id)).length} de {allParticipants.length} libres</span>
              <span className="text-muted">·</span>
              <span className="text-muted">Asígnale un slot a cada participante</span>
            </div>
          )}

          {/* Rounds */}
          <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0">
            <div className="flex gap-4 sm:gap-6 px-4 sm:px-0 min-w-max">
              {rounds.map((round: any) => (
                <div key={round.id} ref={round.roundNumber === rounds.length ? lastRoundRef : null} className="flex flex-col gap-3 min-w-[260px] sm:min-w-[300px]">
                  {/* Round header */}
                  <div className="flex items-center justify-between mb-1 px-1">
                    <h3 className="text-xs font-black text-gold uppercase tracking-widest">Ronda {round.roundNumber}</h3>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteClick(round.id)}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${
                          deleteConfirm === round.id
                            ? "bg-red-500/20 text-red-400 scale-110"
                            : "text-muted hover:text-red-400"
                        }`}
                        title={deleteConfirm === round.id ? "Click otra vez para confirmar" : "Eliminar ronda"}
                      >
                        {deleteConfirm === round.id ? (
                          <Trash2 className="w-4 h-4 animate-pulse" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted text-center">{round.matches.length} enfrentamiento{round.matches.length !== 1 ? "s" : ""}</p>

                  {/* Matches */}
                  {round.matches.map((match: any) => {
                    const p1 = allParticipants.find((p) => p.id === match.team1Id) || null;
                    const p2 = allParticipants.find((p) => p.id === match.team2Id) || null;
                    const hasBoth = p1 && p2;
                    const ws = getWinnerSide(match);
                    const isDecided = match.status === "COMPLETED" || !!ws;

                    return (
                      <div key={match.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                        <div className="bg-gold/5 px-3 py-1.5 border-b border-border flex items-center justify-between">
                          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                            #{match.bracketPosition !== null ? match.bracketPosition + 1 : "?"}
                          </span>
                          {isDecided && (
                            <span className="text-[9px] text-green-400 font-bold">Completado</span>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          {/* Participant A */}
                          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border-2 transition-all ${
                            p1
                              ? ws === "team1"
                                ? "bg-green-500/10 text-green-400 border-green-500/40"
                                : ws
                                  ? "bg-muted/10 text-muted border-muted/30"
                                  : "bg-background border-border"
                              : "border-dashed border-border hover:border-gold/50 bg-background/50"
                          }`}>
                            {p1 ? (
                              <>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  ws === "team1" ? "bg-green-500 text-white" : ws === "team2" ? "bg-muted/30 text-muted" : "bg-gold/10 text-gold"
                                }`}>
                                  {p1.name[0].toUpperCase()}
                                </div>
                                <span className={`font-medium flex-1 ${ws === "team2" ? "text-muted line-through" : ""} ${ws === "team1" ? "text-green-400" : ""}`}>{p1.name}</span>
                                {canEdit && hasBoth && !isDecided && (
                                  <button
                                    onClick={() => confirmMarkWinner(match.id, match.team1Id, round.id)}
                                    disabled={marking === match.id}
                                    className="px-3 py-1.5 bg-gold text-background rounded-lg text-[10px] font-bold hover:bg-gold-hover transition-all disabled:opacity-70 min-w-[72px] flex items-center justify-center gap-1"
                                  >
                                    {marking === match.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : markSuccess === match.id ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      "GANADOR"
                                    )}
                                  </button>
                                )}
                                {isDecided && canEdit && (
                                  <button
                                    onClick={() => revokeWinner(match.id, round.id)}
                                    disabled={marking === match.id}
                                    className="px-2 py-1 text-[10px] text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Revocar victoria"
                                  >
                                    ↩
                                  </button>
                                )}
                                <button onClick={() => removeSlot(match.id, "team1")} className="p-1 text-muted hover:text-red-400 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <SlotSelector label="Slot A" participants={allParticipants} onSelect={(pid) => assignSlot(match.id, "team1", pid)} />
                            )}
                            {!p1 && !p2 && canEdit && (
                              <button onClick={() => deleteMatch(match.id, round.id)}
                                className="p-1 text-muted hover:text-red-400 transition-colors ml-auto" title="Eliminar enfrentamiento">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted font-bold">
                            <div className="flex-1 h-px bg-border" />
                            {!hasBoth ? <span className="px-2 py-0.5 bg-gold/10 text-gold rounded text-[9px]">BYE</span> : <span className="px-3 py-0.5 bg-gold/10 text-gold rounded text-[9px]">VS</span>}
                            <div className="flex-1 h-px bg-border" />
                          </div>

                          {/* Participant B */}
                          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border-2 transition-all ${
                            p2
                              ? ws === "team2"
                                ? "bg-green-500/10 text-green-400 border-green-500/40"
                                : ws
                                  ? "bg-muted/10 text-muted border-muted/30"
                                  : "bg-background border-border"
                              : "border-dashed border-border hover:border-gold/50 bg-background/50"
                          }`}>
                            {p2 ? (
                              <>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  ws === "team2" ? "bg-green-500 text-white" : ws === "team1" ? "bg-muted/30 text-muted" : "bg-gold/10 text-gold"
                                }`}>
                                  {p2.name[0].toUpperCase()}
                                </div>
                                <span className={`font-medium flex-1 ${ws === "team1" ? "text-muted line-through" : ""} ${ws === "team2" ? "text-green-400" : ""}`}>{p2.name}</span>
                                {canEdit && hasBoth && !isDecided && (
                                  <button
                                    onClick={() => confirmMarkWinner(match.id, match.team2Id, round.id)}
                                    disabled={marking === match.id}
                                    className="px-3 py-1.5 bg-gold text-background rounded-lg text-[10px] font-bold hover:bg-gold-hover transition-all disabled:opacity-70 min-w-[72px] flex items-center justify-center gap-1"
                                  >
                                    {marking === match.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : markSuccess === match.id ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      "GANADOR"
                                    )}
                                  </button>
                                )}
                                <button onClick={() => removeSlot(match.id, "team2")} className="p-1 text-muted hover:text-red-400 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <SlotSelector label="Slot B" participants={allParticipants} onSelect={(pid) => assignSlot(match.id, "team2", pid)} />
                            )}
                          </div>

                          {/* Schedule */}
                          {canEdit && (
                            <div className="pt-1.5">
                              {schedulingMatch === `${match.id}-${round.id}` ? (
                                <div className="flex gap-1">
                                  <input type="datetime-local" value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="flex-1 px-2 py-1 bg-background border border-border rounded text-[10px]" />
                                  <button onClick={() => scheduleMatch(match.id, round.id)}
                                    className="px-2 py-1 bg-gold text-background rounded text-[9px] font-bold">OK</button>
                                  <button onClick={() => setSchedulingMatch(null)}
                                    className="px-2 py-1 border border-border rounded text-[9px]">X</button>
                                </div>
                              ) : (
                                <button onClick={() => {
                                  setSchedulingMatch(`${match.id}-${round.id}`);
                                  setScheduleDate(match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : "");
                                }}
                                  className="text-[9px] text-gold hover:underline flex items-center gap-1">
                                  🕐 {match.scheduledAt ? "Cambiar horario" : "Programar"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Scheduled time display */}
                          {match.scheduledAt && (
                            <div className="pt-1">
                              <span className="text-[9px] text-muted">🕐 {new Date(match.scheduledAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          )}

                          {/* Results */}
                          {match.winnerId && (
                            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                              <span className="text-green-400 font-bold">
                                Ganador: {resolveName(match.winnerId)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add match to round */}
                  {canEdit && (
                    <button onClick={() => addMatchToRound(round.id)}
                      className="w-full py-2 border-2 border-dashed border-border rounded-xl text-xs text-muted hover:border-gold/50 hover:text-gold hover:bg-gold/5 transition-all flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Agregar combate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add round button */}
          {canEdit && (
            <div className="flex justify-center pt-2">
              <button onClick={addRound}
                className="px-6 py-3 border-2 border-dashed border-gold/50 rounded-xl text-sm text-gold font-bold hover:bg-gold/10 hover:border-gold transition-all flex items-center gap-2">
                <Plus className="w-5 h-5" /> Agregar Ronda
              </button>
            </div>
          )}
        </>
      )}
      <ToastContainer />

      {/* Winner confirmation dialog */}
      <dialog ref={confirmDialogRef}
        className="rounded-2xl border border-border bg-surface text-foreground p-0 shadow-2xl backdrop:bg-black/60 max-w-sm w-full"
        onClose={() => setWinnerConfirm(null)}>
        {winnerConfirm && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">🏆</div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Declarar ganador</h2>
                <p className="text-xs text-muted">Esta acción avanzará al ganador a la siguiente ronda</p>
              </div>
            </div>
            <div className="bg-background border border-border rounded-xl p-4 mb-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-green-400 font-bold text-sm">👑 {winnerConfirm.winnerName}</span>
                <span className="text-xs text-green-400 font-bold">GANADOR</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-sm line-through">{winnerConfirm.loserName}</span>
                <span className="text-xs text-muted">Perdedor</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { confirmDialogRef.current?.close(); executeMarkWinner(); }}
                className="flex-1 bg-green-600 hover:bg-green-700">Confirmar</Button>
              <Button variant="outline" onClick={() => { confirmDialogRef.current?.close(); setWinnerConfirm(null); }}
                className="flex-1">Cancelar</Button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function SlotSelector({ label, participants, onSelect }: {
  label: string;
  participants: { id: string; name: string }[];
  onSelect: (id: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const filtered = search
    ? participants.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : participants;

  const openSelector = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setShow(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (participants.length === 0) {
    return (
      <div className="flex items-center gap-2 w-full py-1">
        <UserPlus className="w-4 h-4 text-muted shrink-0" />
        <span className="text-xs text-muted">{label} — sin disponibles</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        onClick={openSelector}
        className="flex items-center gap-2 w-full py-2 px-2 border-2 border-dashed border-border rounded-xl hover:border-gold/50 hover:bg-gold/5 transition-all text-left"
      >
        <UserPlus className="w-4 h-4 text-gold shrink-0" />
        <span className="text-sm text-muted font-medium">{label}</span>
      </button>

      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div
            className="fixed z-50 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            style={{ top: position.top, left: position.left, width: Math.max(position.width, 260) }}
          >
            {/* Search input */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            {/* Participants list */}
            <div className="max-h-[220px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-xs text-muted text-center">Sin resultados</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p.id); setShow(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-background transition-colors flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
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
