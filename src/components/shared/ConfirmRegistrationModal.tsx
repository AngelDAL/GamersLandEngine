"use client";

import { useState } from "react";
import { User, Shield, X, AlertTriangle, UserCheck } from "lucide-react";

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

  const handleConfirm = () => {
    if (!isIndividual && mode === "captain" && !teamName.trim()) {
      setError("El nombre del equipo es obligatorio");
      return;
    }
    onConfirm(isIndividual ? undefined : mode === "captain" ? teamName.trim() : undefined);
  };

  // Individual tournament: simple confirm
  if (isIndividual) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Registrar jugador</h2>
          <p className="text-sm text-muted mb-2">{username}</p>
          <p className="text-xs text-muted mb-6">Se registrará directamente al torneo sin equipo</p>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors"
            >
              REGISTRAR
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-border text-muted rounded-xl text-sm hover:border-gold/50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Team tournament: show mode-specific UI
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 max-w-sm w-full">
        <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
          {mode === "captain" ? (
            <Shield className="w-7 h-7 text-gold" />
          ) : (
            <User className="w-7 h-7 text-gold" />
          )}
        </div>

        <h2 className="text-xl font-bold text-foreground text-center mb-1">
          {mode === "captain" ? "Registrar como Capitán" : "Registrar como Agente Libre"}
        </h2>
        <p className="text-sm text-muted text-center mb-5">{username}</p>

        {mode === "captain" && (
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
            />
            {error && (
              <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        )}

        {mode === "free" && (
          <div className="bg-background border border-border rounded-xl p-3 mb-5 text-xs text-muted">
            <p>El jugador quedará como <strong className="text-foreground">agente libre</strong>.</p>
            <p className="mt-1">Podrá postularse a equipos o ser reclutado por capitanes.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleConfirm} className="flex-1 py-3 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors">
            CONFIRMAR
          </button>
          <button onClick={onCancel} className="flex-1 py-3 border border-border text-muted rounded-xl text-sm hover:border-gold/50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
