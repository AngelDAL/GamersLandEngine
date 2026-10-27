"use client";

import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";

type SettingsProps = {
  userEmail: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
};

export function SettingsPanel({ userEmail, emailVerified, hasPassword }: SettingsProps) {
  const { update } = useSession();

  // Email state
  const [email, setEmail] = useState(userEmail || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Clear messages after a few seconds
  useEffect(() => {
    if (emailMsg) {
      const t = setTimeout(() => setEmailMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [emailMsg]);

  useEffect(() => {
    if (passwordMsg) {
      const t = setTimeout(() => setPasswordMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [passwordMsg]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg(null);

    try {
      const res = await fetch("/api/auth/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          currentPassword: hasPassword ? emailPassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailMsg({ type: "error", text: data.error || "Error al actualizar correo" });
      } else {
        setEmailMsg({ type: "success", text: data.message || "Correo actualizado" });
        setEmailPassword("");
        update(); // refresh session
      }
    } catch {
      setEmailMsg({ type: "error", text: "Error de conexión" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ type: "error", text: data.error || "Error al cambiar contraseña" });
      } else {
        setPasswordMsg({ type: "success", text: data.message || "Contraseña cambiada" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Error de conexión" });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ────── Email section ────── */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl shadow-black/20">
        <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-5">
          <Mail className="w-5 h-5" />
          Correo electrónico
        </h2>

        <div className="flex items-center gap-2 mb-4">
          <span className={`w-2 h-2 rounded-full ${userEmail ? (emailVerified ? "bg-green-400" : "bg-amber-400") : "bg-red-400"}`} />
          <span className="text-sm text-muted">
            {userEmail
              ? emailVerified
                ? "✓ Correo verificado"
                : "⚠ Pendiente de verificación"
              : "✗ No has registrado un correo"}
          </span>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
            required
          />

          {hasPassword && userEmail && (
            <div className="relative">
              <input
                type={showEmailPassword ? "text" : "password"}
                placeholder="Tu contraseña actual para confirmar"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowEmailPassword(!showEmailPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {emailMsg && (
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
              emailMsg.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}>
              {emailMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{emailMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={emailLoading || !email.trim()}
            className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
          >
            {emailLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {userEmail ? "ACTUALIZAR CORREO" : "REGISTRAR CORREO"}
          </button>
        </form>
      </div>

      {/* ────── Password section ────── */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl shadow-black/20">
        <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5" />
          Contraseña
        </h2>

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
            required
          />

          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <input
            type="password"
            placeholder="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
            required
          />

          {passwordMsg && (
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
              passwordMsg.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}>
              {passwordMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
          >
            {passwordLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            CAMBIAR CONTRASEÑA
          </button>
        </form>
      </div>
    </div>
  );
}
