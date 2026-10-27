"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, Search, Loader2, ShieldCheck, KeyRound, Trash2, X, Copy,
  RefreshCw, UserCog, AlertTriangle,
} from "lucide-react";

type Role = "ADMIN" | "ORGANIZER" | "PLAYER" | "SPONSOR" | "EXPOSITOR" | "EJECUTIVO";

type UserRow = {
  id: string;
  username: string;
  role: Role;
  createdAt?: string;
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  ORGANIZER: "Organizador",
  PLAYER: "Jugador",
  SPONSOR: "Patrocinador",
  EXPOSITOR: "Expositor",
  EJECUTIVO: "Ejecutivo",
};

const roleBadge: Record<Role, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  ORGANIZER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SPONSOR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PLAYER: "bg-green-500/20 text-green-400 border-green-500/30",
  EXPOSITOR: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  EJECUTIVO: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const assignableRoles: Role[] = ["ADMIN", "ORGANIZER", "PLAYER", "SPONSOR"];

function generatePassword(): string {
  // ≥6 caracteres: base legible + número + símbolo corto
  const words = ["torneo", "llave", "equipo", "premio", "bracket", "jugador", "partida", "guia"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 90 + 10);
  return `${w}${n}!`;
}

type ModalState =
  | null
  | { kind: "role"; user: UserRow; nextRole: Role }
  | { kind: "reset"; user: UserRow }
  | { kind: "delete"; user: UserRow };

export function AdminUsersClient({ initialUsers }: { initialUsers?: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers || []);
  const [loading, setLoading] = useState(!initialUsers);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [resetValue, setResetValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setBlocked(false);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) {
        setBlocked(true);
        setUsers([]);
        return;
      }
      if (res.status === 401) {
        setBlocked(true);
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setError("No pudimos cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUsers) return;
    // setTimeout(0): el fetch arranca fuera del cuerpo síncrono del efecto
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [initialUsers, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, query]);

  const openReset = (user: UserRow) => {
    setResetValue(generatePassword());
    setModal({ kind: "reset", user });
  };

  const confirmRole = async () => {
    if (!modal || modal.kind !== "role") return;
    const { user, nextRole } = modal;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo cambiar el rol.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
      toast.success(`${user.username} ahora es ${roleLabels[nextRole].toLowerCase()}`);
      setModal(null);
    } catch {
      toast.error("No se pudo cambiar el rol. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!modal || modal.kind !== "reset") return;
    const { user } = modal;
    if (resetValue.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetValue }),
      });
      if (res.status === 404) {
        toast.error("Esta función aún no está disponible. Pídesela al equipo técnico.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo restablecer la contraseña.");
        return;
      }
      toast.success(`Contraseña actualizada para ${user.username}`);
      setModal(null);
    } catch {
      toast.error("No se pudo restablecer la contraseña. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const copyResetValue = async () => {
    try {
      await navigator.clipboard.writeText(resetValue);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No se pudo copiar. Selecciona y copia manualmente.");
    }
  };

  const confirmDelete = async () => {
    if (!modal || modal.kind !== "delete") return;
    const { user } = modal;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Primero reasigna sus torneos/equipos");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo eliminar el usuario.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.username} eliminado`);
      setModal(null);
    } catch {
      toast.error("No se pudo eliminar el usuario. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full pl-10 pr-4 py-3 min-h-11 bg-surface border border-border rounded-xl text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-gold animate-spin" />
        </div>
      )}

      {!loading && blocked && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-gold mx-auto mb-3 opacity-60" />
          <p className="text-sm text-muted">
            Necesitas permiso de administrador para ver la lista de usuarios.
          </p>
        </div>
      )}

      {!loading && !blocked && error && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold text-gold border border-gold/40 rounded-xl hover:bg-gold/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      {!loading && !blocked && !error && (
        <div className="bg-surface border border-border rounded-xl max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              {query ? "Ningún usuario coincide con tu búsqueda" : "No hay usuarios registrados"}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((u) => (
                <li key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-gold/10 text-gold shrink-0">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.username}</p>
                      <span
                        className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadge[u.role] || ""}`}
                      >
                        {roleLabels[u.role] || u.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rol segmentado */}
                    <div className="flex bg-background border border-border rounded-lg p-0.5 gap-0.5">
                      {assignableRoles.map((r) => (
                        <button
                          key={r}
                          onClick={() => setModal({ kind: "role", user: u, nextRole: r })}
                          disabled={u.role === r || busy}
                          className={`px-2.5 py-2 min-h-9 rounded text-[10px] font-bold transition-colors ${
                            u.role === r
                              ? "bg-gold text-background"
                              : "text-muted hover:text-foreground hover:bg-surface"
                          }`}
                          title={`Cambiar a ${roleLabels[r]}`}
                        >
                          {roleLabels[r]}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => openReset(u)}
                      className="p-2 min-w-10 min-h-10 flex items-center justify-center text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
                      title="Restablecer contraseña"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setModal({ kind: "delete", user: u })}
                      className="p-2 min-w-10 min-h-10 flex items-center justify-center text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Modal del sistema ── */}
      {modal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !busy && setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-foreground">
                {modal.kind === "role" && "Confirmar cambio de rol"}
                {modal.kind === "reset" && "Restablecer contraseña"}
                {modal.kind === "delete" && "Eliminar usuario"}
              </h3>
              <button
                onClick={() => !busy && setModal(null)}
                className="p-2 -m-1 text-muted hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modal.kind === "role" && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  <strong className="text-foreground">{modal.user.username}</strong> pasará de{" "}
                  <strong>{roleLabels[modal.user.role]}</strong> a{" "}
                  <strong>{roleLabels[modal.nextRole]}</strong>.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setModal(null)}
                    disabled={busy}
                    className="px-4 py-2.5 min-h-10 text-sm font-bold text-muted border border-border rounded-xl hover:bg-background transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmRole}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold bg-gold text-background rounded-xl hover:bg-gold-hover transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                    Cambiar rol
                  </button>
                </div>
              </div>
            )}

            {modal.kind === "reset" && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Nueva contraseña para <strong className="text-foreground">{modal.user.username}</strong>:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetValue}
                    onChange={(e) => setResetValue(e.target.value)}
                    className="flex-1 px-3 py-3 min-h-11 bg-background border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:border-gold"
                    autoFocus
                  />
                  <button
                    onClick={copyResetValue}
                    className="p-3 min-w-11 min-h-11 flex items-center justify-center text-gold border border-gold/40 rounded-xl hover:bg-gold/10 transition-colors"
                    title="Copiar contraseña"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {resetValue.length < 6 && (
                  <p className="text-xs text-amber-400">Usa al menos 6 caracteres.</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setModal(null)}
                    disabled={busy}
                    className="px-4 py-2.5 min-h-10 text-sm font-bold text-muted border border-border rounded-xl hover:bg-background transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmReset}
                    disabled={busy || resetValue.length < 6}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold bg-gold text-background rounded-xl hover:bg-gold-hover transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Guardar contraseña
                  </button>
                </div>
              </div>
            )}

            {modal.kind === "delete" && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">
                    Vas a eliminar a <strong>{modal.user.username}</strong>. Perderá su acceso,
                    su historial quedará vinculado a su cuenta y{" "}
                    <strong>si administra torneos o equipos deberás reasignarlos primero</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setModal(null)}
                    disabled={busy}
                    className="px-4 py-2.5 min-h-10 text-sm font-bold text-muted border border-border rounded-xl hover:bg-background transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold bg-red text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar usuario
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
