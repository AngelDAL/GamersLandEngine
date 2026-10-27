"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { UserPlus, Loader2, CheckCircle, LogIn } from "lucide-react";

type Props = {
  teamId: string;
  teamName: string;
};

export function JoinClient({ teamId, teamName }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/teams/${teamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al unirse al equipo");
      setLoading(false);
      return;
    }

    setLoading(false);
    setJoined(true);
  };

  const handleCreateAndJoin = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");

    // Create account
    const result = await signIn("credentials", {
      username: username.trim(),
      redirect: false,
    });

    if (result?.error) {
      setError("Error al crear la cuenta");
      setLoading(false);
      return;
    }

    // Join team
    const res = await fetch(`/api/teams/${teamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al unirse al equipo");
      setLoading(false);
      return;
    }

    setLoading(false);
    setJoined(true);
  };

  if (joined) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-green-400 mb-1">¡Bienvenido a {teamName}!</h2>
        <p className="text-muted text-sm mb-4">Ya eres parte del equipo.</p>
        <button
          onClick={() => router.push(`/teams/${teamId}`)}
          className="px-6 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors"
        >
          Ir al equipo
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
        <span className="text-sm text-muted">Cargando...</span>
      </div>
    );
  }

  // ── LOGGED IN ──
  if (session) {
    return (
      <div>
        {error && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-base"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          {loading ? "Uniéndote..." : "Unirse al equipo"}
        </button>
        <p className="text-xs text-muted mt-2">
          Sesión iniciada como <strong>{session.user?.name}</strong>
        </p>
      </div>
    );
  }

  // ── NOT LOGGED IN ──
  return (
    <div>
      <h2 className="text-base font-bold text-foreground mb-3">¿Quieres unirte?</h2>
      <p className="text-xs text-muted mb-4">
        Crea una cuenta con tu nombre de usuario. Al registrarte, se entenderá que quieres unirte a <strong>{teamName}</strong>.
      </p>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Tu nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateAndJoin()}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold text-base"
          autoFocus
        />
        <p className="text-[10px] text-muted -mt-1">
          Si el usuario no existe, se creará automáticamente
        </p>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCreateAndJoin}
          disabled={loading || !username.trim()}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          {loading ? "Creando cuenta..." : "CREAR CUENTA Y UNIRME"}
        </button>
      </div>
    </div>
  );
}
