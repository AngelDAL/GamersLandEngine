"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X, UserCheck, Shield } from "lucide-react";

type Props = {
  type: "registered" | "already" | "captain" | "error";
  username: string;
  teamName?: string;
  onClose: () => void;
};

export function RegistrationOverlay({ type, username, teamName, onClose }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const config = {
    registered: {
      icon: UserCheck,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/30",
      title: "Registrado exitosamente",
      desc: `${username} ahora es parte del torneo`,
    },
    already: {
      icon: AlertCircle,
      color: "text-gold",
      bg: "bg-gold/10 border-gold/30",
      title: "Ya estaba registrado",
      desc: `${username} ya pertenecía a este torneo`,
    },
    captain: {
      icon: Shield,
      color: "text-gold",
      bg: "bg-gold/10 border-gold/30",
      title: "Equipo creado y registrado",
      desc: `${teamName || username} liderado por ${username}`,
    },
    error: {
      icon: X,
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      title: "Error al registrar",
      desc: username,
    },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className={`relative max-w-sm w-full border-2 rounded-2xl p-8 text-center ${c.bg}`}>
        <div className={`w-20 h-20 rounded-full ${c.bg.replace("border", "border-0")} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-10 h-10 ${c.color}`} />
        </div>
        <h2 className={`text-xl font-black ${c.color} mb-2`}>{c.title}</h2>
        <p className="text-sm text-muted">{c.desc}</p>

        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
}
