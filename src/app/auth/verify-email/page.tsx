"use client";

import { useState, useEffect, use } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = use(searchParams);
  const token = resolvedParams?.token || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token de verificación no encontrado.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage("¡Correo verificado exitosamente!");
        } else {
          setStatus("error");
          setMessage(data.error || "Error al verificar el correo.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión. Intenta de nuevo.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md mx-4">
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl shadow-black/20 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 text-gold mx-auto mb-4 animate-spin" />
              <p className="text-gold font-bold">Verificando correo...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-green-400 font-bold text-lg mb-2">{message}</p>
              <p className="text-sm text-muted mb-6">Ya puedes iniciar sesión con tu cuenta.</p>
              <Link
                href="/auth/login"
                className="inline-block px-6 py-3 bg-gold text-background font-bold rounded-xl hover:bg-gold-hover transition-colors"
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <p className="text-red-400 font-bold text-lg mb-2">Error</p>
              <p className="text-sm text-muted mb-6">{message}</p>
              <Link
                href="/auth/login"
                className="text-gold hover:text-gold-hover font-medium"
              >
                Volver al inicio de sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
