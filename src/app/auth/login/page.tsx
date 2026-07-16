"use client";

import { useState, useEffect } from "react";
import { Gamepad2, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => d.csrfToken && setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || loading) return;
    setLoading(true);
    setError("");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/callback/credentials";
    form.style.display = "none";

    const addField = (name: string, value: string) => {
      const el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      el.value = value;
      form.appendChild(el);
    };

    addField("username", username.trim());
    addField("password", password);
    addField("csrfToken", csrfToken);
    addField("callbackUrl", window.location.origin + "/");

    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-accent/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-gold" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">GAMERSLAND</h1>
          <p className="text-muted mt-2">Inicia sesión con tu cuenta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20"
        >
          <div className="space-y-2 mb-4">
            <label className="block text-sm text-muted font-medium">Usuario o correo</label>
            <input
              type="text"
              placeholder="Ej: ProPlayer99"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-2 mb-4">
            <label className="block text-sm text-muted font-medium">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-xs text-gold hover:text-gold-hover transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-gold/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {loading ? "Entrando..." : "INICIAR SESIÓN"}
          </button>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted text-center">
              ¿No tienes cuenta?{' '}
              <Link href="/auth/register" className="text-gold hover:text-gold-hover font-medium">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
