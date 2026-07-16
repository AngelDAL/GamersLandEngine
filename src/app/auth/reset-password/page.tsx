"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(searchParams);
  const token = resolvedParams?.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Enlace inválido. Solicita un nuevo restablecimiento.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || loading) return;

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al restablecer la contraseña");
        return;
      }

      setSuccess(data.message || "Contraseña actualizada.");

      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-surface border border-red-500/30 rounded-2xl p-8 max-w-md mx-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 font-bold mb-2">Enlace inválido</p>
          <p className="text-sm text-muted mb-4">
            Este enlace de restablecimiento no es válido.
          </p>
          <Link
            href="/auth/forgot-password"
            className="text-gold hover:text-gold-hover font-medium"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-accent/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground tracking-tight">NUEVA CONTRASEÑA</h1>
          <p className="text-muted mt-2">Elige una contraseña segura</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-green-400 font-bold mb-2">¡Contraseña actualizada!</p>
              <p className="text-sm text-muted mb-4">{success}</p>
              <p className="text-xs text-muted">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-2 mb-4">
                <label className="block text-sm text-muted font-medium">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg pr-12"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label className="block text-sm text-muted font-medium">Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-3.5 bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg ${
                    confirmPassword && password !== confirmPassword
                      ? "border-red-500"
                      : "border-border"
                  }`}
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
                disabled={loading || !password}
                className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-gold/20"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Gamepad2 className="w-5 h-5" />
                )}
                {loading ? "Guardando..." : "GUARDAR CONTRASEÑA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
