"use client";

import { useState, useEffect, useRef } from "react";
import { Gamepad2, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => d.csrfToken && setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || loading) return;
    setLoading(true);
    setError("");

    // Submit mediante formulario nativo para manejar cookies/redirect correctamente
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
    addField("csrfToken", csrfToken);
    addField("callbackUrl", window.location.origin + "/");

    document.body.appendChild(form);
    form.submit();
    // El navegador maneja el POST, cookies y redirect automáticamente
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
          <p className="text-muted mt-2">Ingresa con tu nombre de usuario</p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20">
          <div className="space-y-2 mb-6">
            <label className="block text-sm text-muted font-medium">Nombre de usuario</label>
            <input
              type="text"
              placeholder="Ej: ProPlayer99"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg"
              autoFocus
            />
            <p className="text-xs text-muted">Si no existe, se creará una cuenta automáticamente</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-gold/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? "Entrando..." : "ENTRAR"}
          </button>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted text-center">No necesitas email ni contraseña — solo un nombre único</p>
          </div>
        </form>
      </div>
    </div>
  );
}
