"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, Search, Scan, Loader2 } from "lucide-react";

type Props = { teamId: string };

export function TeamClient({ teamId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"username" | "qr">("username");

  const addMember = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    // Search by username
    const userRes = await fetch(`/api/users?q=${encodeURIComponent(search.trim())}`);
    const users = await userRes.json();

    // If searching by QR code (UUID), try direct lookup
    let user = users[0];
    if (!user && search.includes("-")) {
      const qrRes = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: search.trim() }),
      });
      if (qrRes.ok) {
        const data = await qrRes.json();
        user = data.user;
      }
    }

    if (!user) {
      setError("Usuario no encontrado. Verifica el username o código QR.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        message: "Agregado por el líder del equipo",
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al agregar miembro");
    } else {
      setSuccess(`${user.username} ha sido agregado al equipo`);
      setSearch("");
    }

    setLoading(false);
    router.refresh();
  };

  return (
    <Card>
      <h2 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
        <UserPlus className="w-4 h-4" />
        Agregar miembro
      </h2>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode("username")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === "username" ? "bg-gold text-background" : "bg-background text-muted"
          }`}
        >
          <Search className="w-3 h-3" />
          Username
        </button>
        <button
          onClick={() => setMode("qr")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === "qr" ? "bg-gold text-background" : "bg-background text-muted"
          }`}
        >
          <Scan className="w-3 h-3" />
          QR
        </button>
      </div>

      {mode === "username" ? (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Nombre de usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
          />
          <Button onClick={addMember} disabled={loading || !search.trim()} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Código QR o ID del jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
          />
          <Button onClick={addMember} disabled={loading || !search.trim()} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {error && <p className="text-red text-xs mb-1">{error}</p>}
      {success && <p className="text-green-400 text-xs mb-1">{success}</p>}
      <p className="text-[10px] text-muted">
        {mode === "username" ? "Busca por username exacto" : "Escanea o ingresa el código QR del jugador"}
      </p>
    </Card>
  );
}
