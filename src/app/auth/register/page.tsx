"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrarse");
        return;
      }

      setSuccess(data.message || "Cuenta creada. Revisa tu correo.");

      // Redirect to login after a moment
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
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
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-gold" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">CREAR CUENTA</h1>
          <p className="text-muted mt-2">Regístrate para jugar torneos en GamersLand</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20"
        >
          {success ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-green-400 font-bold mb-2">¡Registro exitoso!</p>
              <p className="text-sm text-muted mb-4">{success}</p>
              <p className="text-xs text-muted">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                <label className="block text-sm text-muted font-medium">
                  Nombre de usuario <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: ProPlayer99"
                  value={form.username}
                  onChange={handleChange("username")}
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg"
                  autoFocus
                />
                <p className="text-xs text-muted">3–24 caracteres, solo letras, números y _</p>
              </div>

              <div className="space-y-2 mb-4">
                <label className="block text-sm text-muted font-medium">
                  Correo electrónico <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={form.email}
                  onChange={handleChange("email")}
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg"
                />
                <p className="text-xs text-muted">Necesario para recuperar tu cuenta</p>
              </div>

              <div className="space-y-2 mb-4">
                <label className="block text-sm text-muted font-medium">
                  Contraseña <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={handleChange("password")}
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
              </div>

              <div className="space-y-2 mb-6">
                <label className="block text-sm text-muted font-medium">
                  Confirmar contraseña <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={form.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  className={`w-full px-4 py-3.5 bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-lg ${
                    form.confirmPassword && form.password !== form.confirmPassword
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
                disabled={
                  loading ||
                  !form.username.trim() ||
                  !form.email.trim() ||
                  !form.password
                }
                className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 text-background font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-gold/20"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Gamepad2 className="w-5 h-5" />
                )}
                {loading ? "Creando cuenta..." : "CREAR CUENTA"}
              </button>

              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted text-center">
                  ¿Ya tienes cuenta?{' '}
                  <Link href="/auth/login" className="text-gold hover:text-gold-hover font-medium">
                    Inicia sesión
                  </Link>
                </p>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
