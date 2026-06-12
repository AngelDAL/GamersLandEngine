"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CreateTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear equipo");
      setLoading(false);
      return;
    }

    const team = await res.json();
    router.push(`/teams/${team.id}`);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-6">Crear Equipo</h1>

      <form onSubmit={createTeam}>
        <Card className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Nombre del equipo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded text-foreground placeholder-muted focus:outline-none focus:border-gold"
              placeholder="Ej: Los Pro Players"
              autoFocus
            />
          </div>

          {error && <p className="text-red text-sm">{error}</p>}

          <Button type="submit" disabled={loading || !name.trim()} className="w-full">
            {loading ? "Creando..." : "CREAR EQUIPO"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
