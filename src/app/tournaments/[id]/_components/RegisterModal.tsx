"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { X, UserPlus, Loader2, Gamepad2 } from "lucide-react";

type Props = {
  tournamentId: string;
  onClose: () => void;
};

export function RegisterModal({ tournamentId, onClose }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [step, setStep] = useState<"login" | "choose" | "created">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateAndRegister = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");

    // Sign in (creates user if not exists)
    const result = await signIn("credentials", {
      username: username.trim(),
      redirect: false,
    });

    if (result?.error) {
      setError("Error al crear la cuenta");
      setLoading(false);
      return;
    }

    // Register for tournament
    const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al registrarse");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("created");
  };

  if (step === "created") {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gold mb-2">¡Registrado!</h2>
          <p className="text-muted text-sm mb-6">
            Tu cuenta se ha creado y ya estás registrado en el torneo.
            Ahora puedes crear un equipo o unirte a uno existente.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { router.push(`/teams/create`); onClose(); }}
              className="px-6 py-3 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover"
            >
              Crear Equipo
            </button>
            <button
              onClick={() => { router.refresh(); onClose(); }}
              className="px-6 py-3 border border-border text-muted rounded-xl text-sm hover:border-gold/50"
            >
              Ver Torneo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
          <Gamepad2 className="w-6 h-6 text-gold" />
        </div>
        <h2 className="text-xl font-bold text-foreground text-center mb-1">Participar en el torneo</h2>
        <p className="text-muted text-sm text-center mb-6">
          Ingresa tu nombre de usuario para crear tu cuenta y registrarte
        </p>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Tu nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAndRegister()}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold text-lg"
              autoFocus
            />
            <p className="text-xs text-muted mt-1">
              Si el usuario no existe, se creará automáticamente
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateAndRegister}
            disabled={loading || !username.trim()}
            className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            {loading ? "Creando cuenta..." : "CREAR CUENTA Y PARTICIPAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
