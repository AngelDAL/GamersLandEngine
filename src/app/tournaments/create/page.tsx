"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const GAMES = [
  { value: "LEAGUE_OF_LEGENDS", label: "League of Legends (5v5)" },
  { value: "VALORANT", label: "Valorant (5v5)" },
  { value: "FORTNITE", label: "Fortnite" },
  { value: "LOL_1V1", label: "League of Legends (1v1)" },
] as const;

const BRACKET_TYPES = [
  { value: "SINGLE_ELIMINATION", label: "Eliminación Simple" },
  { value: "DOUBLE_ELIMINATION", label: "Doble Eliminación" },
  { value: "ROUND_ROBIN", label: "Round Robin" },
  { value: "SWISS", label: "Suizo" },
] as const;

export default function CreateTournamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    game: "LEAGUE_OF_LEGENDS",
    description: "",
    entryFee: "",
    maxTeams: "8",
    minTeams: "4",
    isTeamBased: true,
    bracketType: "SINGLE_ELIMINATION",
    eventDate: "",
    registrationDeadline: "",
    location: "",
    rules: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: field === "isTeamBased" ? value === "true" : value,
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.name || !form.eventDate) {
      setError("Nombre y fecha del evento son requeridos");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        game: form.game,
        description: form.description || undefined,
        entryFee: form.entryFee ? parseFloat(form.entryFee) : undefined,
        maxTeams: parseInt(form.maxTeams),
        minTeams: parseInt(form.minTeams),
        isTeamBased: form.isTeamBased,
        bracketType: form.bracketType,
        eventDate: form.eventDate,
        registrationDeadline: form.registrationDeadline || undefined,
        location: form.location || undefined,
        rules: form.rules || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear torneo");
      setLoading(false);
      return;
    }

    const tournament = await res.json();
    router.push(`/tournaments/${tournament.id}/manage`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Crear Torneo</h1>
      <p className="text-muted text-sm mb-8">Define los detalles del nuevo torneo</p>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-5 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Nombre del torneo *</label>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
                placeholder="Ej: LOL Cup #2"
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Juego</label>
              <select
                value={form.game}
                onChange={(e) => update("game", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
              >
                {GAMES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Tipo de torneo</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update("isTeamBased", "true")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                    form.isTeamBased === true
                      ? "bg-gold text-background"
                      : "bg-background border border-border text-muted"
                  }`}
                >
                  Por equipos
                </button>
                <button
                  type="button"
                  onClick={() => update("isTeamBased", "false")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                    form.isTeamBased === false
                      ? "bg-gold text-background"
                      : "bg-background border border-border text-muted"
                  }`}
                >
                  Individual
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Tipo de bracket</label>
              <select
                value={form.bracketType}
                onChange={(e) => update("bracketType", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
              >
                {BRACKET_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">{form.isTeamBased ? "Cupo máximo de equipos" : "Cupo máximo de jugadores"}</label>
              <input
                type="number"
                value={form.maxTeams}
                onChange={(e) => update("maxTeams", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
                min={2}
                max={128}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">{form.isTeamBased ? "Cupo mínimo de equipos" : "Cupo mínimo de jugadores"}</label>
              <input
                type="number"
                value={form.minTeams}
                onChange={(e) => update("minTeams", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
                min={2}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Cuota de entrada ($)</label>
              <input
                type="number"
                value={form.entryFee}
                onChange={(e) => update("entryFee", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
                placeholder="0 = gratuito"
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Ubicación (física)</label>
              <input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
                placeholder="Ej: Sala principal, stand 5"
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Fecha del evento *</label>
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => update("eventDate", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Fecha límite de registro</label>
              <input
                type="datetime-local"
                value={form.registrationDeadline}
                onChange={(e) => update("registrationDeadline", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold min-h-[80px]"
                placeholder="Reglas, premios, detalles..."
              />
            </div>
          </div>

          {error && <p className="text-red text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creando..." : "CREAR TORNEO"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
