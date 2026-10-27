"use client";

import { useState } from "react";
import { Gamepad2, Loader2, CheckCircle, AlertCircle, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar el correo");
        return;
      }

      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-accent/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
          </Link>
          <h1 className="text-3xl font-black text-foreground tracking-tight">RECUPERAR CONTRASEÑA</h1>
          <p className="text-muted mt-2">Te enviaremos un enlace para restablecerla</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20">
          {sent ? (
            <div className="text-center py-6">
              <Mail className="w-16 h-16 text-gold mx-auto mb-4" />
              <p className="text-gold font-bold mb-2">Correo enviado</p>
              <p className="text-sm text-muted mb-4">
                Si {email} está registrado, recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="text-xs text-muted">Revisa tu bandeja de entrada y spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-2 mb-6">
                <label className="block text-sm text-muted font-medium">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-gold/20"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                {loading ? "Enviando..." : "ENVIAR ENLACE"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
