"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, Search, Scan, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

type Props = { teamId: string };

type UserSuggestion = { id: string; username: string; avatarUrl: string | null };

export function TeamClient({ teamId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const { socket } = useSocket(session?.user?.id);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"username" | "qr">("username");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [fetching, setFetching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch suggestions on input change (debounced)
  useEffect(() => {
    if (mode !== "username" || search.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(search.trim())}&role=PLAYER`);
        const users = await res.json();
        setSuggestions(Array.isArray(users) ? users.slice(0, 8) : []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
      setFetching(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, mode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectUser = useCallback(async (user: UserSuggestion) => {
    setSearch(user.username);
    setShowSuggestions(false);
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        message: "Agregado por el líder del equipo",
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al agregar miembro");
    } else {
      const data = await res.json();
      setSuccess(`Invitación enviada a ${user.username}. Recibirá una notificación.`);
      // Emit socket notification to the invited user
      if (socket && data.invitedUserId) {
        socket.emit("notification:send", {
          userId: data.invitedUserId,
          title: "Invitación a equipo",
          message: `${session?.user?.name} te ha invitado a unirte a su equipo.`,
          type: "team_invite",
          redirectUrl: `/teams/${teamId}`,
        });
      }
      setSearch("");
      setSuggestions([]);
    }
    setLoading(false);
    router.refresh();
  }, [teamId, router]);

  const addMember = async () => {
    if (!search.trim()) return;
    // If there's an exact match in suggestions, use it
    const exact = suggestions.find(s => s.username.toLowerCase() === search.trim().toLowerCase());
    if (exact) {
      await selectUser(exact);
      return;
    }
    // Otherwise search directly
    setLoading(true);
    setError("");
    setSuccess("");

    const userRes = await fetch(`/api/users?q=${encodeURIComponent(search.trim())}`);
    const users = await userRes.json();

    let user = users[0];
    if (!user && search.includes("-")) {
      const qrRes = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: search.trim() }),
      });
      if (qrRes.ok) {
        const data = await qrRes.json();
        user = data.user;
      }
    }

    if (!user) {
      setError("Usuario no encontrado. Verifica el username o código QR.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, message: "Agregado por el líder del equipo" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al agregar miembro");
    } else {
      const data = await res.json();
      setSuccess(`Invitación enviada a ${user.username}. Recibirá una notificación.`);
      // Emit socket notification to the invited user
      if (socket && data.invitedUserId) {
        socket.emit("notification:send", {
          userId: data.invitedUserId,
          title: "Invitación a equipo",
          message: `${session?.user?.name} te ha invitado a unirte a su equipo.`,
          type: "team_invite",
          redirectUrl: `/teams/${teamId}`,
        });
      }
      setSearch("");
      setSuggestions([]);
    }
    setLoading(false);
    router.refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        selectUser(suggestions[selectedIdx]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIdx(-1);
      }
    } else if (e.key === "Enter") {
      addMember();
    }
  };

  return (
    <Card>
      <h2 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
        <UserPlus className="w-4 h-4" />
        Agregar miembro
      </h2>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => { setMode("username"); setSearch(""); setSuggestions([]); setShowSuggestions(false); }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === "username" ? "bg-gold text-background" : "bg-background text-muted"
          }`}
        >
          <Search className="w-3 h-3" />
          Username
        </button>
        <button
          onClick={() => { setMode("qr"); setSearch(""); setSuggestions([]); setShowSuggestions(false); }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === "qr" ? "bg-gold text-background" : "bg-background text-muted"
          }`}
        >
          <Scan className="w-3 h-3" />
          QR
        </button>
      </div>

      {mode === "username" ? (
        <div className="relative" ref={dropdownRef}>
          <div className="flex gap-2 mb-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Nombre de usuario..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedIdx(-1); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
              autoComplete="off"
            />
            <Button onClick={addMember} disabled={loading || !search.trim()} size="sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-12 top-full -mt-1 bg-surface border border-border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
              {fetching && suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted">Sin resultados</div>
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => selectUser(s)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left ${
                      i === selectedIdx ? "bg-gold/10 text-gold" : "text-foreground hover:bg-background"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                      {s.username[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{s.username}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Código QR o ID del jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
          />
          <Button onClick={addMember} disabled={loading || !search.trim()} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {error && <p className="text-red text-xs mb-1">{error}</p>}
      {success && <p className="text-green-400 text-xs mb-1">{success}</p>}
      <p className="text-[10px] text-muted">
        {mode === "username" ? "Escribe al menos 2 letras para buscar jugadores" : "Escanea o ingresa el código QR del jugador"}
      </p>
    </Card>
  );
}
