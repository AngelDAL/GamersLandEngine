"use client";

import { useState } from "react";
import { User, Shield, X, AlertTriangle, UserCheck, Loader2 } from "lucide-react";

type Props = {
  username: string;
  mode: "free" | "captain";
  isIndividual: boolean;
  onConfirm: (teamName?: string) => void;
  onCancel: () => void;
};

export function ConfirmRegistrationModal({ username, mode, isIndividual, onConfirm, onCancel }: Props) {
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    if (!isIndividual && mode === "captain" && !teamName.trim()) {
      setError("El nombre del equipo es obligatorio");
      return;
    }
    setLoading(true);
    onConfirm(isIndividual ? undefined : mode === "captain" ? teamName.trim() : undefined);
  };

  const btnBase = "flex-1 py-3 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={loading ? undefined : onCancel}>
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          {isIndividual ? (
            <UserCheck className="w-7 h-7 text-green-400" />
          ) : mode === "captain" ? (
            <Shield className="w-7 h-7 text-gold" />
          ) : (
            <User className="w-7 h-7 text-gold" />
          )}
        </div>

        <h2 className="text-xl font-bold text-foreground text-center mb-1">
          {isIndividual ? "Registrar jugador" : mode === "captain" ? "Registrar como Capitán" : "Registrar como Agente Libre"}
        </h2>
        <p className="text-sm text-muted text-center mb-2">{username}</p>

        {isIndividual && (
          <p className="text-xs text-muted text-center mb-6">Se registrará directamente al torneo sin equipo</p>
        )}

        {!isIndividual && mode === "captain" && (
          <div className="mb-4">
            <label className="block text-xs text-muted mb-1.5 font-medium">
              Nombre del equipo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Los Pro Players"
              value={teamName}
              onChange={(e) => { setTeamName(e.target.value); setError(""); }}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
                <AlertTriangle className="w-3 h-3" /> {error}
              </p>
            )}
          </div>
        )}

        {!isIndividual && mode === "free" && (
          <div className="bg-background border border-border rounded-xl p-3 mb-5 text-xs text-muted">
            <p>Quedará como <strong className="text-foreground">agente libre</strong>.</p>
            <p className="mt-1">Podrá postularse a equipos o ser reclutado.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleConfirm} disabled={loading}
            className={`${btnBase} bg-gold text-background hover:bg-gold-hover disabled:opacity-60`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Registrando..." : "CONFIRMAR"}
          </button>
          <button onClick={onCancel} disabled={loading}
            className={`${btnBase} border border-border text-muted hover:border-gold/50 disabled:opacity-40`}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
