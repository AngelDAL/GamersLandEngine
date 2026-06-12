"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send, Loader2, MessageSquare } from "lucide-react";

type Props = {
  teamId: string;
  teamName: string;
  tournamentId: string;
  userId: string;
  onClose: () => void;
};

export function TeamApplyModal({ teamId, teamName, tournamentId, userId, onClose }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleApply = async () => {
    setLoading(true);
    setError("");

    // First register for tournament if not already
    await fetch(`/api/tournaments/${tournamentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Send team join request with message
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message: message.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al enviar solicitud");
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-gold" />
          </div>
          <h2 className="text-xl font-bold text-gold mb-2">Solicitud enviada</h2>
          <p className="text-muted text-sm mb-6">
            El líder del equipo revisará tu solicitud y te aceptará si encajas
          </p>
          <button onClick={onClose} className="px-6 py-3 bg-gold text-background font-bold rounded-xl text-sm">
            ENTENDIDO
          </button>
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
          <MessageSquare className="w-6 h-6 text-gold" />
        </div>
        <h2 className="text-xl font-bold text-foreground text-center mb-1">
          Postularse a {teamName}
        </h2>
        <p className="text-muted text-sm text-center mb-6">
          Cuéntales quién eres, qué juego, rol y rango tienes
        </p>

        <div className="space-y-4">
          <textarea
            placeholder="Ej: Main mid, oro 2, 3 años de experiencia en torneos locales..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold min-h-[120px] resize-none"
            autoFocus
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={loading || !message.trim()}
            className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loading ? "Enviando..." : "ENVIAR SOLICITUD"}
          </button>
        </div>
      </div>
    </div>
  );
}
