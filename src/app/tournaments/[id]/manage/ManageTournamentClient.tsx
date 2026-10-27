"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRScanner } from "@/components/player/QRScanner";
import { RegistrationOverlay } from "@/components/shared/RegistrationOverlay";
import { ConfirmRegistrationModal } from "@/components/shared/ConfirmRegistrationModal";
import { TeamDnD } from "@/components/tournament/TeamDnD";
import { TeamRequestsPanel } from "@/components/tournament/TeamRequestsPanel";
import { showToast, ToastContainer } from "@/components/shared/Toast";
import { useSocket } from "@/hooks/useSocket";
import {
  Settings, Swords, Trophy, Users, UserPlus, Shield,
  Search, Check, X, Loader2,
  User, UserCheck, Camera, Plus, Info, Filter, Trash2,
  Clock, Undo2, Ban, AlertTriangle, Crown, ClipboardCheck,
} from "lucide-react";
import { estimateRoundCount } from "@/lib/bracket-engine";
import type { BracketMatch, BracketRound } from "../bracket/BracketInteractive";

type Player = { id: string; username: string; avatarUrl: string | null };
type Team = {
  id: string; name: string; captainId: string;
  captain: { id: string; username: string };
  _count: { members: number };
  members: { id: string; userId: string; user: { id: string; username: string }; status: string }[];
};

type Registration = {
  id: string;
  userId: string;
  paid: boolean;
  checkedInAt: string | null;
  status: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
  team: { id: string; name: string } | null;
};

type PrizeRow = { id: string; name: string; value: string | null; position: number | null };
type OrganizerRow = { id: string; userId: string; user: { id: string; username: string } };
type TournamentTeamRow = {
  id: string;
  teamId: string;
  seed?: number | null;
  team: {
    id: string;
    name: string;
    captainId: string;
    captain: { id: string; username: string };
    _count: { members: number };
    members: { userId: string; status: string; user: { id: string; username: string } }[];
  };
};

type ManageTournament = {
  id: string;
  name: string;
  status: string;
  game: string;
  description: string | null;
  location: string | null;
  imageUrl?: string | null;
  isTeamBased: boolean;
  teamSize: number;
  maxTeams: number;
  entryFee: number | null;
  eventDate: string;
  bracketType: string;
  rounds: BracketRound[];
  prizes: PrizeRow[];
  organizers: OrganizerRow[];
  tournamentTeams: TournamentTeamRow[];
};

type Props = {
  tournament: ManageTournament;
  userId: string;
  players: Player[];
  registrations: Registration[];
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

export function ManageTournamentClient({ tournament, userId, players, registrations, allPlayers, organizers, teams, freeAgents, isAdmin }: Props) {
  const isIndividual = tournament.isTeamBased === false;
  const membersInTeam = new Set(teams.flatMap((t) => t.members.map((m) => m.userId)));
  const router = useRouter();
  const [tab, setTab] = useState<"alta" | "inscripciones" | "equipos" | "general" | "bracket" | "prizes" | "participants">("alta");
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket(userId);

  // Inscripciones: aprobación y pagos
  const [regFilter, setRegFilter] = useState<"PENDING" | "CONFIRMED" | "REJECTED">("PENDING");
  const [approvalConfirm, setApprovalConfirm] = useState<{ regId: string; action: "approve" | "reject"; username: string } | null>(null);
  const [regBusy, setRegBusy] = useState<string | null>(null);

  // Cancelación / eliminación del torneo
  const [cancelTournamentConfirm, setCancelTournamentConfirm] = useState(false);
  const [deleteTournamentConfirm, setDeleteTournamentConfirm] = useState(false);
  const [deleteName, setDeleteName] = useState("");

  // Creación de equipo desde la lista de registrados
  const [createTeamFor, setCreateTeamFor] = useState<{ id: string; username: string } | null>(null);
  const [createTeamName, setCreateTeamName] = useState("");

  // Registrations table toggles
  const [togglingPayment, setTogglingPayment] = useState<string | null>(null);
  const [togglingCheckIn, setTogglingCheckIn] = useState<string | null>(null);
  const [regTableSearch, setRegTableSearch] = useState("");

  // Overlay
  const [overlay, setOverlay] = useState<{ type: "registered" | "already" | "captain" | "error"; username: string; teamName?: string } | null>(null);

  // Alta - Registration
  const [playerSearch, setPlayerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [registerMode, setRegisterMode] = useState<"free" | "captain">("free");
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
  // Sincroniza con el servidor durante el render (patrón permitido: se
  // compara el valor anterior, no se llama a setState dentro de un efecto).
  const [prevTournamentStatus, setPrevTournamentStatus] = useState(tournament.status);
  if (tournament.status !== prevTournamentStatus) {
    setPrevTournamentStatus(tournament.status);
    setStatus(tournament.status);
  }

  // Organizer assignment
  const [selectedOrgId, setSelectedOrgId] = useState("");

  // Bracket team

  // Prizes
  const [prizeName, setPrizeName] = useState("");
  const [prizeValue, setPrizeValue] = useState("");
  const [prizePosition, setPrizePosition] = useState("");

  const showOverlay = useCallback((type: "registered" | "already" | "captain" | "error", username: string, teamName?: string) => {
    setOverlay({ type, username, teamName });
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

  // Sort registrations: unchecked check-in first
  const sortedRegs = [...registrations]
    .filter((r) => r.user.username.toLowerCase().includes(regTableSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.checkedInAt === null && b.checkedInAt !== null) return -1;
      if (a.checkedInAt !== null && b.checkedInAt === null) return 1;
      return 0;
    });

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
      const selectedTeam = teams.find((t) => t.id === teamRegId);
      if (!selectedTeam) { setTeamRegMsg("Equipo no encontrado"); setRegistering(false); return; }

      // 1. Create TournamentTeam record
      const ttRes = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam.id }),
      });
      if (!ttRes.ok) { const e = await ttRes.json(); setTeamRegMsg(e.error || "Error al registrar equipo"); setRegistering(false); return; }

      // 2. Register each active member
      const activeMembers = selectedTeam.members?.filter((m) => m.status === "ACTIVE") || [];
      let registered = 0;
      for (const member of activeMembers) {
        const regRes = await fetch(`/api/tournaments/${tournament.id}/registrations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: member.userId || member.user?.id, teamId: selectedTeam.id }),
        });
        if (regRes.ok) registered++;
      }

      setTeamRegMsg(`Listo: ${selectedTeam.name} registrado (${registered} miembros)`);
      setTeamRegSearch("");
      setTeamRegId("");
      setShowTeamDropdown(false);
    } catch { setTeamRegMsg("Error de conexión"); }
    setRegistering(false);
    router.refresh();
  };

  // Toggle payment for a registration
  const togglePayment = async (regId: string, paid: boolean) => {
    setTogglingPayment(regId);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Error al actualizar el pago", "error");
      } else {
        showToast(paid ? "Marcado como pagado" : "Marcado como pendiente", "success");
        router.refresh();
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setTogglingPayment(null);
  };

  // Toggle check-in for a registration
  const toggleCheckIn = async (regId: string, checkedIn: boolean) => {
    setTogglingCheckIn(regId);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Error al actualizar el check-in", "error");
      } else {
        router.refresh();
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setTogglingCheckIn(null);
  };

  // Aprobar / rechazar una solicitud de inscripción
  const applyApproval = async (regId: string, newStatus: "CONFIRMED" | "REJECTED") => {
    setRegBusy(regId);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Error al actualizar la inscripción", "error");
      } else {
        showToast(newStatus === "CONFIRMED" ? "Inscripción aprobada" : "Inscripción rechazada", "success");
        router.refresh();
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setRegBusy(null);
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
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "No se pudo cambiar el estado", "error");
      } else {
        setStatus(newStatus);
        showToast("Estado actualizado", "success");
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setLoading(false);
    router.refresh();
  };

  const cancelTournament = async () => {
    setCancelTournamentConfirm(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "No se pudo cancelar el torneo", "error");
      } else {
        setStatus("CANCELLED");
        showToast("Torneo cancelado", "success");
      }
    } catch {
      showToast("Error de conexión", "error");
    }
    setLoading(false);
    router.refresh();
  };

  const deleteTournament = async () => {
    if (deleteName.trim() !== tournament.name) return;
    setDeleteTournamentConfirm(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "No se pudo eliminar el torneo", "error");
        setLoading(false);
        return;
      }
      showToast("Torneo eliminado", "success");
      router.push("/tournaments");
      router.refresh();
    } catch {
      showToast("Error de conexión", "error");
    }
    setLoading(false);
  };

  const createTeamForPlayer = async () => {
    if (!createTeamFor || !createTeamName.trim()) return;
    setLoading(true);
    try {
      const teamRes = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createTeamName.trim(), captainId: createTeamFor.id }),
      });
      if (!teamRes.ok) {
        const data = await teamRes.json().catch(() => ({}));
        showToast(data.error || "Error al crear el equipo", "error");
      } else {
        const team = await teamRes.json();
        await fetch(`/api/tournaments/${tournament.id}/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: team.id }),
        });
        showToast(`Equipo "${team.name}" creado`, "success");
        setCreateTeamFor(null);
        setCreateTeamName("");
      }
    } catch {
      showToast("Error de conexión", "error");
    }
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

  // Transiciones válidas: solo al paso anterior o al siguiente del flujo.
  const allowedTargets = (from: string): string[] => {
    const idx = statusFlow.findIndex((s) => s.key === from);
    if (idx < 0) return [];
    const targets: string[] = [];
    if (idx > 0) targets.push(statusFlow[idx - 1].key);
    if (idx < statusFlow.length - 1) targets.push(statusFlow[idx + 1].key);
    return targets;
  };

  const currentIdx = statusFlow.findIndex((s) => s.key === status);
  const registeredTeamIds = tournament.tournamentTeams?.map((tt) => tt.teamId) || [];
  const availableTeams = teams.filter((t) => !registeredTeamIds.includes(t.id));
  const filteredTeams = availableTeams.filter((t) =>
    t.name.toLowerCase().includes(teamRegSearch.toLowerCase())
  );

  const tabs = [
    { id: "alta" as const, label: "Alta", icon: UserPlus, desc: "Registrar" },
    { id: "inscripciones" as const, label: "Inscripciones", icon: UserCheck, desc: "Aprobar" },
    ...(tournament.isTeamBased !== false ? [{ id: "equipos" as const, label: "Equipos", icon: Users, desc: "Armar equipos" }] : []),
    { id: "bracket" as const, label: "Llave", icon: Swords, desc: "Llave" },
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
                  onClick={() => {
                    if (isCurrent || loading) return;
                    if (allowedTargets(status).includes(s.key)) setStatusConfirm(s.key);
                    else showToast("Ese cambio de estado no está permitido", "error");
                  }}
                  disabled={loading || isCurrent}
                  className="flex flex-col items-center gap-1 transition-all group min-h-[44px]"
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 transition-all ${
                    isCurrent
                      ? "bg-gold text-background border-gold shadow-lg shadow-gold/30 scale-110"
                      : isActive
                        ? "bg-green-500/20 text-green-400 border-green-400"
                        : "bg-background text-muted border-border group-hover:border-gold/30"
                  }`}>
                    {isActive ? <Check className="w-4 h-4" /> : i + 1}
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

        {(status !== "CANCELLED" && status !== "COMPLETED") || (isAdmin && status !== "CANCELLED") ? (
          <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
            {status !== "CANCELLED" && status !== "COMPLETED" && (
              <button
                onClick={() => setCancelTournamentConfirm(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Ban className="w-4 h-4" /> Cancelar torneo
              </button>
            )}
            {isAdmin && status !== "CANCELLED" && (
              <button
                onClick={() => { setDeleteName(""); setDeleteTournamentConfirm(true); }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold text-muted border border-border hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Eliminar torneo
              </button>
            )}
          </div>
        ) : null}
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
                              onClick={() => {
                                setCreateTeamFor({ id: p.id, username: p.username });
                                setCreateTeamName("");
                              }}
                              className="px-3 py-2 min-h-[40px] bg-gold/10 text-gold rounded-lg text-[10px] font-bold hover:bg-gold/20 transition-colors whitespace-nowrap"
                            >
                              Crear equipo
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
                      filteredTeams.map((t) => {
                        const mc = t._count?.members || t.members?.filter((m) => m.status === "ACTIVE").length || 0;
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
              <p className={`text-xs mt-2 ${teamRegMsg.startsWith("Listo") ? "text-green-400" : "text-red"}`}>{teamRegMsg}</p>
            )}
          </Card>
        )}

        {/* ═══════ JUGADORES REGISTRADOS (TABLA CON CHECK-IN) ═══════ */}
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gold">Jugadores registrados ({registrations.length})</h2>
            <InfoTip text="Marca la llegada de cada jugador el día del evento. Los pagos se gestionan en la pestaña Inscripciones." />
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder="Buscar por username..."
              value={regTableSearch}
              onChange={(e) => setRegTableSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
            />
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted font-medium">#</th>
                  <th className="text-left py-2 px-2 text-muted font-medium">Usuario</th>
                  <th className="text-left py-2 px-2 text-muted font-medium">Check-in</th>
                  <th className="text-left py-2 px-2 text-muted font-medium">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {sortedRegs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted text-xs">Sin resultados</td>
                  </tr>
                ) : (
                  sortedRegs.map((reg, idx) => (
                    <tr key={reg.id} className="border-b border-border hover:bg-background/50 transition-colors">
                      <td className="py-2 px-2 text-muted">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                            {reg.user.username[0].toUpperCase()}
                          </div>
                          <span className="font-medium">{reg.user.username}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {reg.checkedInAt ? (
                          <button
                            onClick={() => toggleCheckIn(reg.id, false)}
                            disabled={togglingCheckIn === reg.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] rounded-lg text-[10px] font-bold border text-green-400 bg-green-500/10 border-green-500/30 ${
                              togglingCheckIn === reg.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                            }`}
                          >
                            {togglingCheckIn === reg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Llegó a las {new Date(reg.checkedInAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleCheckIn(reg.id, true)}
                            disabled={togglingCheckIn === reg.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] rounded-lg text-[10px] font-bold border text-muted bg-background border-border ${
                              togglingCheckIn === reg.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gold/10 hover:text-gold hover:border-gold/30"
                            }`}
                          >
                            {togglingCheckIn === reg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                No ha llegado
                              </>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted">
                        {new Date(reg.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sortedRegs.length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">Sin resultados</div>
            ) : (
              sortedRegs.map((reg, idx) => (
                <div key={reg.id} className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                        {reg.user.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{reg.user.username}</span>
                    </div>
                    <span className="text-[10px] text-muted">#{idx + 1}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {reg.checkedInAt ? (
                      <button
                        onClick={() => toggleCheckIn(reg.id, false)}
                        disabled={togglingCheckIn === reg.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] rounded-lg text-[10px] font-bold border text-green-400 bg-green-500/10 border-green-500/30 ${
                          togglingCheckIn === reg.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                        }`}
                      >
                        {togglingCheckIn === reg.id ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Llegó {new Date(reg.checkedInAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleCheckIn(reg.id, true)}
                        disabled={togglingCheckIn === reg.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] rounded-lg text-[10px] font-bold border text-muted bg-background border-border ${
                          togglingCheckIn === reg.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gold/10 hover:text-gold hover:border-gold/30"
                        }`}
                      >
                        {togglingCheckIn === reg.id ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            No ha llegado
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </>
      )}

      {/* ═══════ INSCRIPCIONES (aprobaciones y pagos) ═══════ */}
      {tab === "inscripciones" && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-gold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" /> Inscripciones
            </h2>
            <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border overflow-x-auto">
              {([
                { key: "PENDING", label: "Pendientes" },
                { key: "CONFIRMED", label: "Aprobadas" },
                { key: "REJECTED", label: "Rechazadas" },
              ] as const).map((f) => {
                const count = registrations.filter((r) => r.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    onClick={() => setRegFilter(f.key)}
                    aria-pressed={regFilter === f.key}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      regFilter === f.key ? "bg-gold text-background" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {f.label}{count > 0 ? ` (${count})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
            {regFilter === "PENDING" &&
              (registrations.filter((r) => r.status === "PENDING").length === 0 ? (
                <div className="text-center py-10 text-muted text-xs">
                  <ClipboardCheck className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p>No hay solicitudes pendientes</p>
                </div>
              ) : (
                registrations
                  .filter((r) => r.status === "PENDING")
                  .map((reg) => (
                    <div key={reg.id} className="bg-background border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                          {reg.user.username[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{reg.user.username}</p>
                          <p className="text-[10px] text-muted truncate">
                            {reg.team ? `Equipo: ${reg.team.name} · ` : ""}
                            {new Date(reg.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                            {reg.paid ? " · Pagado" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setApprovalConfirm({ regId: reg.id, action: "approve", username: reg.user.username })}
                          disabled={regBusy === reg.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-lg text-xs font-bold bg-green-500/10 border border-green-500/40 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        >
                          {regBusy === reg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Aprobar
                        </button>
                        <button
                          onClick={() => setApprovalConfirm({ regId: reg.id, action: "reject", username: reg.user.username })}
                          disabled={regBusy === reg.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))
              ))}

            {regFilter === "CONFIRMED" &&
              (registrations.filter((r) => r.status === "CONFIRMED").length === 0 ? (
                <div className="text-center py-10 text-muted text-xs">
                  <UserCheck className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p>Aún no hay inscripciones aprobadas</p>
                </div>
              ) : (
                registrations
                  .filter((r) => r.status === "CONFIRMED")
                  .map((reg) => (
                    <div key={reg.id} className="bg-background border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                          {reg.user.username[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{reg.user.username}</p>
                          <p className="text-[10px] text-muted truncate">
                            {reg.team ? `Equipo: ${reg.team.name} · ` : ""}
                            {new Date(reg.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-background border border-border p-1 rounded-xl shrink-0" role="group" aria-label="Estado de pago">
                        <button
                          onClick={() => { if (!reg.paid) togglePayment(reg.id, true); }}
                          disabled={togglingPayment === reg.id}
                          aria-pressed={reg.paid}
                          className={`inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg text-[11px] font-bold transition-all ${
                            reg.paid ? "bg-green-500/15 border border-green-500/40 text-green-400" : "text-muted hover:text-foreground border border-transparent"
                          }`}
                        >
                          {togglingPayment === reg.id && reg.paid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Pagado
                        </button>
                        <button
                          onClick={() => { if (reg.paid) togglePayment(reg.id, false); }}
                          disabled={togglingPayment === reg.id}
                          aria-pressed={!reg.paid}
                          className={`inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg text-[11px] font-bold transition-all ${
                            !reg.paid ? "bg-amber-500/15 border border-amber-500/40 text-amber-300" : "text-muted hover:text-foreground border border-transparent"
                          }`}
                        >
                          {!reg.paid && togglingPayment === reg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                          Pendiente
                        </button>
                      </div>
                    </div>
                  ))
              ))}

            {regFilter === "REJECTED" &&
              (registrations.filter((r) => r.status === "REJECTED").length === 0 ? (
                <div className="text-center py-10 text-muted text-xs">
                  <X className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p>No hay inscripciones rechazadas</p>
                </div>
              ) : (
                registrations
                  .filter((r) => r.status === "REJECTED")
                  .map((reg) => (
                    <div key={reg.id} className="bg-background border border-border rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">
                        {reg.user.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{reg.user.username}</p>
                        <p className="text-[10px] text-muted truncate">
                          {reg.team ? `Equipo: ${reg.team.name} · ` : ""}
                          {new Date(reg.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 shrink-0">
                        Rechazada
                      </span>
                    </div>
                  ))
              ))}
          </div>
        </Card>
      )}

      {/* ═══════ EQUIPOS ═══════ */}
      {tab === "equipos" && (
        <><TeamRequestsPanel tournamentId={tournament.id} />
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
      </>)}

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
          bracketType={tournament.bracketType}
          rounds={tournament.rounds || []}
          players={players}
          teams={teams}
          isIndividual={isIndividual}
          canEdit={true}
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
                {tournament.prizes.map((p) => (
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
                {tournament.tournamentTeams.map((tt) => (
                  <div key={tt.id} className="bg-background border border-border rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs">{tt.team.name}</h3>
                      <span className="text-[10px] text-muted">{tt.team.members?.length || 0}/5</span>
                    </div>
                    <p className="text-[10px] text-muted"><Shield className="w-2.5 h-2.5 inline" /> {tt.team.captain?.username}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tt.team.members?.map((m) => (
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
                {tournament.organizers?.map((o) => (
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
                      {organizers.filter((o) => !tournament.organizers?.some((to) => to.user.id === o.id)).map((o) => (
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

      {/* ── Modal: aprobar / rechazar inscripción ── */}
      {approvalConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              approvalConfirm.action === "approve" ? "bg-green-500/15" : "bg-red-500/15"
            }`}>
              {approvalConfirm.action === "approve"
                ? <Check className="w-7 h-7 text-green-400" />
                : <X className="w-7 h-7 text-red-400" />}
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {approvalConfirm.action === "approve" ? "Aprobar inscripción" : "Rechazar inscripción"}
            </h2>
            <p className="text-sm text-muted mb-6">
              {approvalConfirm.action === "approve"
                ? `La solicitud de ${approvalConfirm.username} pasará a Aprobada y ocupará un cupo.`
                : `La solicitud de ${approvalConfirm.username} quedará rechazada y liberará su cupo.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const { regId, action } = approvalConfirm;
                  setApprovalConfirm(null);
                  applyApproval(regId, action === "approve" ? "CONFIRMED" : "REJECTED");
                }}
                className={`flex-1 py-3 min-h-[44px] font-bold rounded-xl text-sm ${
                  approvalConfirm.action === "approve"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {approvalConfirm.action === "approve" ? "APROBAR" : "RECHAZAR"}
              </button>
              <button
                onClick={() => setApprovalConfirm(null)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: cancelar torneo ── */}
      {cancelTournamentConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Cancelar torneo</h2>
            <p className="text-sm text-muted mb-6">
              <strong className="text-foreground">{tournament.name}</strong> quedará como Cancelado: se detienen
              las inscripciones y los partidos. Los datos del torneo se conservan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelTournament}
                disabled={loading}
                className="flex-1 py-3 min-h-[44px] bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "..." : "SÍ, CANCELAR EL TORNEO"}
              </button>
              <button
                onClick={() => setCancelTournamentConfirm(false)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: eliminar torneo (solo administradores) ── */}
      {deleteTournamentConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-red-500/40 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Eliminar torneo</h2>
                <p className="text-xs text-muted">Acción permanente</p>
              </div>
            </div>
            <p className="text-sm text-muted mb-4">
              Se borrará <strong className="text-foreground">{tournament.name}</strong> con todas sus
              inscripciones, llaves, resultados y premios. No se puede deshacer.
            </p>
            <input
              type="text"
              value={deleteName}
              onChange={(e) => setDeleteName(e.target.value)}
              placeholder={tournament.name}
              className="w-full px-3 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted focus:outline-none focus:border-red-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={deleteTournament}
                disabled={deleteName.trim() !== tournament.name || loading}
                className="flex-1 py-3 min-h-[44px] bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "ELIMINAR DEFINITIVAMENTE"}
              </button>
              <button
                onClick={() => setDeleteTournamentConfirm(false)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: crear equipo desde la lista ── */}
      {createTeamFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Crear equipo</h2>
                <p className="text-xs text-muted">{createTeamFor.username} será el capitán</p>
              </div>
            </div>
            <input
              type="text"
              value={createTeamName}
              onChange={(e) => setCreateTeamName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createTeamForPlayer(); }}
              placeholder="Nombre del equipo"
              className="w-full px-3 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={createTeamForPlayer}
                disabled={!createTeamName.trim() || loading}
                className="flex-1 py-3 min-h-[44px] bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover disabled:opacity-40"
              >
                {loading ? "..." : "CREAR EQUIPO"}
              </button>
              <button
                onClick={() => setCreateTeamFor(null)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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

      <ToastContainer />
    </div>
  );
}

function BracketBuilder({
  tournamentId, tournamentStatus, bracketType, rounds, players, teams, isIndividual, canEdit, tournamentTeams,
}: {
  tournamentId: string; tournamentStatus: string; bracketType: string; rounds: BracketRound[];
  players: { id: string; username: string }[];
  teams: Team[]; isIndividual: boolean; canEdit: boolean;
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

  // Confirmaciones del sistema (nunca confirm()/alert() nativos)
  const [generateConfirm, setGenerateConfirm] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<{ matchId: string; roundId: string } | null>(null);

  // Winner confirmation dialog
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [winnerConfirm, setWinnerConfirm] = useState<{
    matchId: string; winnerId: string; roundId: string; winnerName: string; loserName: string;
  } | null>(null);

  const tournamentTeamIds = new Set((tournamentTeams || []).map((tt) => tt.teamId));
  const allParticipants = isIndividual
    ? players.map((p) => ({ id: p.id, name: p.username }))
    : teams.filter((t) => tournamentTeamIds.has(t.id)).map((t) => ({ id: t.id, name: t.name }));

  const assignedIds = new Set<string>();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.team1Id) assignedIds.add(match.team1Id);
      if (match.team2Id) assignedIds.add(match.team2Id);
    }
  }

  // La construcción manual (slots a mano) solo existe en planeación/registro
  // abierto; el marcador y la revocación siguen disponibles siempre.
  const manualEditable = ["DRAFT", "OPEN_REGISTRATION"].includes(tournamentStatus);
  const participantCount = allParticipants.length;
  const estimatedRounds = estimateRoundCount(bracketType, participantCount);
  const unsupportedDouble = bracketType === "DOUBLE_ELIMINATION" && estimatedRounds === null;

  // Generación real de la llave (el servidor arma rondas, byes y avances)
  const generateBracket = async () => {
    setGenerateConfirm(false);
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMsg(data.error || "No se pudo generar la llave");
      } else {
        setStatusMsg(`Llave generada con ${data.roundCount} ${data.roundCount === 1 ? "ronda" : "rondas"}${data.byes ? ` y ${data.byes} ${data.byes === 1 ? "participante sin rival" : "participantes sin rival"}` : ""}`);
      }
    } catch {
      setStatusMsg("Error de conexión al generar la llave");
    }
    setLoading(false);
    router.refresh();
  };

  const initBracket = async () => {
    setLoading(true); setStatusMsg("");
    const count = allParticipants.length;
    if (count < 2) { setStatusMsg("Se necesitan al menos 2 participantes"); setLoading(false); return; }
    let n = 2; while (n < count) n *= 2;
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket/init`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numSlots: n }),
    });
    setStatusMsg(res.ok ? "Estructura manual creada" : (await res.json()).error || "Error");
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

  // `key` identifica la operación en curso para quien la dispare (el toast ya
  // informa el progreso al usuario).
  const withToast = async (key: string, action: () => Promise<unknown>, successMsg: string) => {
    showToast("Procesando...", "loading");
    try {
      await action();
      showToast(successMsg, "success");
    } catch {
      showToast(`Error al procesar (${key})`, "error");
    }
    router.refresh();
  };

  const deleteMatch = async (matchId: string, roundId: string) => {
    await withToast(`del-match-${matchId}`, async () => {
      await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, { method: "DELETE" });
    }, "Enfrentamiento eliminado");
  };

  const resolveName = (id: string | null) => id ? allParticipants.find((p) => p.id === id)?.name || "---" : "---";

  // Determine winner side (works for team and individual tournaments)
  const getWinnerSide = (match: BracketMatch): "team1" | "team2" | null => {
    if (match.winnerId) return match.winnerId === match.team1Id ? "team1" : "team2";
    if ((match.score1 ?? 0) > (match.score2 ?? 0)) return "team1";
    if ((match.score2 ?? 0) > (match.score1 ?? 0)) return "team2";
    return null;
  };

  // Open confirmation dialog before marking winner
  const confirmMarkWinner = (matchId: string, winnerId: string | null, roundId: string) => {
    if (!winnerId) return;
    const currentMatch = rounds.find((r) => r.id === roundId)?.matches.find((m) => m.id === matchId);
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

    const currentMatch = rounds.find((r) => r.id === roundId)?.matches.find((m) => m.id === matchId);
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

    // El avance y el cierre del torneo los resuelve el servidor.

    setMarkSuccess(matchId);
    setTimeout(() => { setMarkSuccess(null); setMarking(null); }, 1500);
    router.refresh();
  };

  // Revocar un ganador: confirmación del sistema y luego el endpoint real
  // (deshace avance, borra resultados y devuelve el torneo a curso si hizo falta)
  const executeRevoke = async () => {
    if (!revokeConfirm) return;
    const { matchId, roundId } = revokeConfirm;
    setRevokeConfirm(null);
    setMarking(matchId);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId: null, status: "PENDING", score1: null, score2: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        setStatusMsg(err.error || "No se pudo revocar el resultado");
      } else {
        setStatusMsg("Resultado revocado");
      }
    } catch {
      setStatusMsg("Error de conexión al revocar");
    }
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
    const round = rounds.find((r) => r.id === roundId);
    const nextPos = round?.matches?.length || 0;
    await withToast(`add-match-${roundId}`, async () => {
      await fetch(`/api/tournaments/${tournamentId}/rounds/${roundId}/matches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketPosition: nextPos }),
      });
    }, "Combate agregado");
  };

  const hasRounds = rounds.length > 0;

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
            {participantCount < 2
              ? `Se necesitan al menos 2 participantes aprobados (actual: ${participantCount})`
              : "Aún no se genera la llave"}
          </p>
          {canEdit && unsupportedDouble && (
            <p className="text-xs text-red-400 mb-4">
              Doble eliminación no disponible para más de 8 participantes
            </p>
          )}
          {canEdit && (
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={() => setGenerateConfirm(true)}
                disabled={loading || participantCount < 2 || unsupportedDouble}
                size="lg"
                className="min-h-[44px]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" />}
                {loading ? "Generando..." : "Generar llave"}
              </Button>
              {manualEditable && participantCount >= 2 && (
                <button
                  onClick={initBracket}
                  disabled={loading}
                  className="text-xs text-muted hover:text-gold underline underline-offset-4 disabled:opacity-50"
                >
                  Construcción manual
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      {hasRounds && (
        <>
          {/* Pool - compact */}
          {canEdit && manualEditable && allParticipants.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-muted flex-wrap">
              <Users className="w-3.5 h-3.5 text-gold shrink-0" />
              <span className="font-medium">{allParticipants.filter((p) => !assignedIds.has(p.id)).length} de {allParticipants.length} libres</span>
            </div>
          )}

          {/* Rounds */}
          <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0">
            <div className="flex gap-4 sm:gap-6 px-4 sm:px-0 min-w-max">
              {rounds.map((round) => (
                <div key={round.id} ref={round.roundNumber === rounds.length ? lastRoundRef : null} className="flex flex-col gap-3 min-w-[260px] sm:min-w-[300px]">
                  {/* Round header */}
                  <div className="flex items-center justify-between mb-1 px-1">
                    <h3 className="text-xs font-black text-gold uppercase tracking-widest">Ronda {round.roundNumber}</h3>
                    {canEdit && manualEditable && (
                      <button
                        onClick={() => handleDeleteClick(round.id)}
                        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-all duration-200 ${
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
                  {round.matches.map((match) => {
                    const p1 = allParticipants.find((p) => p.id === match.team1Id) || null;
                    const p2 = allParticipants.find((p) => p.id === match.team2Id) || null;
                    const hasBoth = p1 && p2;
                    const ws = getWinnerSide(match);
                    const isDecided = match.status === "COMPLETED" || !!ws;

                    return (
                      <div key={match.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                        <div className="bg-gold/5 px-3 py-1.5 border-b border-border flex items-center justify-between">
                          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                            #{typeof match.bracketPosition === "number" ? match.bracketPosition + 1 : "?"}
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
                                    className="px-3 py-2 min-h-[40px] bg-gold text-background rounded-lg text-[10px] font-bold hover:bg-gold-hover transition-all disabled:opacity-70 min-w-[72px] flex items-center justify-center gap-1"
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
                                    onClick={() => setRevokeConfirm({ matchId: match.id, roundId: round.id })}
                                    disabled={marking === match.id}
                                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] text-[10px] text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Revocar victoria"
                                  >
                                    <Undo2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEdit && manualEditable && (
                                  <button onClick={() => removeSlot(match.id, "team1")} className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] text-muted hover:text-red-400 transition-colors" title="Quitar del slot">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : manualEditable ? (
                              <SlotSelector label="Slot A" participants={allParticipants} onSelect={(pid) => assignSlot(match.id, "team1", pid)} />
                            ) : (
                              <span className="text-xs text-muted">Por asignar</span>
                            )}
                            {!p1 && !p2 && canEdit && manualEditable && (
                              <button onClick={() => deleteMatch(match.id, round.id)}
                                className="p-2 min-w-[40px] min-h-[40px] text-muted hover:text-red-400 transition-colors ml-auto" title="Eliminar enfrentamiento">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted font-bold">
                            <div className="flex-1 h-px bg-border" />
                            {!p1 || !p2 ? (
                              <span className="px-2 py-1 bg-gold/10 text-gold rounded text-[9px]">
                                {!p1 && !p2 ? "Por definir" : "Sin rival (pasa de ronda)"}
                              </span>
                            ) : (
                              <span className="px-3 py-0.5 bg-gold/10 text-gold rounded text-[9px]">VS</span>
                            )}
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
                                    className="px-3 py-2 min-h-[40px] bg-gold text-background rounded-lg text-[10px] font-bold hover:bg-gold-hover transition-all disabled:opacity-70 min-w-[72px] flex items-center justify-center gap-1"
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
                                {canEdit && manualEditable && (
                                  <button onClick={() => removeSlot(match.id, "team2")} className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] text-muted hover:text-red-400 transition-colors" title="Quitar del slot">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : manualEditable ? (
                              <SlotSelector label="Slot B" participants={allParticipants} onSelect={(pid) => assignSlot(match.id, "team2", pid)} />
                            ) : (
                              <span className="text-xs text-muted">Por asignar</span>
                            )}
                          </div>

                          {/* Schedule */}
                          {canEdit && (
                            <div className="pt-1.5">
                              {schedulingMatch === `${match.id}-${round.id}` ? (
                                <div className="flex gap-1">
                                  <input type="datetime-local" value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="flex-1 px-2 py-2 min-h-[40px] bg-background border border-border rounded text-[11px]" />
                                  <button onClick={() => scheduleMatch(match.id, round.id)}
                                    className="px-3 min-h-[40px] bg-gold text-background rounded text-[10px] font-bold">Guardar</button>
                                  <button onClick={() => setSchedulingMatch(null)}
                                    className="px-3 min-h-[40px] border border-border rounded text-[10px] text-muted">Cancelar</button>
                                </div>
                              ) : (
                                <button onClick={() => {
                                  setSchedulingMatch(`${match.id}-${round.id}`);
                                  setScheduleDate(match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : "");
                                }}
                                  className="min-h-[40px] w-full text-[10px] text-gold hover:underline flex items-center justify-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" /> {match.scheduledAt ? "Cambiar horario" : "Programar"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Scheduled time display */}
                          {match.scheduledAt && (
                            <div className="pt-1">
                              <span className="text-[9px] text-muted inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(match.scheduledAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
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
                  {canEdit && manualEditable && (
                    <button onClick={() => addMatchToRound(round.id)}
                      className="w-full py-2.5 min-h-[40px] border-2 border-dashed border-border rounded-xl text-xs text-muted hover:border-gold/50 hover:text-gold hover:bg-gold/5 transition-all flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Agregar combate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add round button */}
          {canEdit && manualEditable && (
            <div className="flex justify-center pt-2">
              <button onClick={addRound}
                className="px-6 py-3 min-h-[44px] border-2 border-dashed border-gold/50 rounded-xl text-sm text-gold font-bold hover:bg-gold/10 hover:border-gold transition-all flex items-center gap-2">
                <Plus className="w-5 h-5" /> Agregar Ronda
              </button>
            </div>
          )}
        </>
      )}

      {/* Winner confirmation dialog */}
      <dialog ref={confirmDialogRef}
        className="rounded-2xl border border-border bg-surface text-foreground p-0 shadow-2xl backdrop:bg-black/60 max-w-sm w-full"
        onClose={() => setWinnerConfirm(null)}>
        {winnerConfirm && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Declarar ganador</h2>
                <p className="text-xs text-muted">El servidor moverá al ganador a la siguiente ronda</p>
              </div>
            </div>
            <div className="bg-background border border-border rounded-xl p-4 mb-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-green-400 font-bold text-sm inline-flex items-center gap-1.5 min-w-0">
                  <Crown className="w-4 h-4 shrink-0" />
                  <span className="truncate">{winnerConfirm.winnerName}</span>
                </span>
                <span className="text-xs text-green-400 font-bold shrink-0">GANADOR</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted text-sm line-through truncate">{winnerConfirm.loserName}</span>
                <span className="text-xs text-muted shrink-0">Perdedor</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { confirmDialogRef.current?.close(); executeMarkWinner(); }}
                className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700">Confirmar</Button>
              <Button variant="outline" onClick={() => { confirmDialogRef.current?.close(); setWinnerConfirm(null); }}
                className="flex-1 min-h-[44px]">Cancelar</Button>
            </div>
          </div>
        )}
      </dialog>

      {/* ── Modal: generar llave ── */}
      {generateConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Swords className="w-7 h-7 text-gold" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Generar llave</h2>
            <p className="text-sm text-muted mb-2">
              Se crearán <strong className="text-gold">{estimatedRounds}</strong>{" "}
              {estimatedRounds === 1 ? "ronda" : "rondas"} con los {participantCount} participantes
              aprobados; el torneo pasará a <strong className="text-gold">En curso</strong>.
            </p>
            <p className="text-xs text-muted mb-6">
              {bracketType === "ROUND_ROBIN"
                ? "Todos los cruces se juegan una vez."
                : bracketType === "DOUBLE_ELIMINATION"
                  ? "Se generan las ramas superior e inferior."
                  : "Cada derrota elimina; los sin rival avanzan."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={generateBracket}
                disabled={loading}
                className="flex-1 py-3 min-h-[44px] bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover disabled:opacity-50"
              >
                {loading ? "GENERANDO..." : "GENERAR LLAVE"}
              </button>
              <button
                onClick={() => setGenerateConfirm(false)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: revocar resultado ── */}
      {revokeConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Undo2 className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Revocar resultado</h2>
            <p className="text-sm text-muted mb-6">
              El partido volverá a pendiente, se borrará el marcador, el ganador
              regresará a su slot y los resultados se eliminan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={executeRevoke}
                disabled={marking !== null}
                className="flex-1 py-3 min-h-[44px] bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 disabled:opacity-50"
              >
                REVOGAR
              </button>
              <button
                onClick={() => setRevokeConfirm(null)}
                className="flex-1 py-3 min-h-[44px] border border-border text-muted rounded-xl text-sm hover:border-gold/50"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
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

const gameLabels: Record<string, string> = {
  LEAGUE_OF_LEGENDS: "League of Legends",
  VALORANT: "Valorant",
  FORTNITE: "Fortnite",
  LOL_1V1: "LoL 1v1",
};

const bracketLabels: Record<string, string> = {
  SINGLE_ELIMINATION: "Eliminación Simple",
  DOUBLE_ELIMINATION: "Doble Eliminación",
  ROUND_ROBIN: "Round Robin",
  SWISS: "Suizo",
};

function EditTournamentForm({ tournament }: { tournament: ManageTournament }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: tournament.name,
    description: tournament.description || "",
    maxTeams: String(tournament.maxTeams),
    entryFee: tournament.entryFee ? String(tournament.entryFee) : "",
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
          <div><span className="text-muted">Juego:</span> {gameLabels[tournament.game?.toUpperCase()] ?? tournament.game}</div>
          <div><span className="text-muted">Cupos:</span> {tournament.maxTeams}</div>
          <div><span className="text-muted">Cuota:</span> {tournament.entryFee ? `$${tournament.entryFee}` : "Gratis"}</div>
          <div><span className="text-muted">Fecha:</span> {new Date(tournament.eventDate).toLocaleDateString()}</div>
          <div><span className="text-muted">Ubicación:</span> {tournament.location || "---"}</div>
          <div><span className="text-muted">Modalidad:</span> {bracketLabels[tournament.bracketType] ?? tournament.bracketType}</div>
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
