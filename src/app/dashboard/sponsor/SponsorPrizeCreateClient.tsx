"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Gift } from "lucide-react";

type Tournament = { id: string; name: string; status: string };

type PrizeType = "POSITION" | "PARTICIPATION";

const typeOptions: { value: PrizeType; label: string }[] = [
  { value: "POSITION", label: "Posición" },
  { value: "PARTICIPATION", label: "Participación" },
];

const positionOptions = [1, 2, 3];

export function SponsorPrizeCreateClient() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [tournamentId, setTournamentId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<PrizeType>("POSITION");
  const [position, setPosition] = useState(1);
  const [value, setValue] = useState("");
  const [maxClaims, setMaxClaims] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tournaments");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          const list = (Array.isArray(data) ? data : []).filter(
            (t: Tournament) => t.status !== "CANCELLED",
          );
          setTournaments(list);
          if (list.length > 0) setTournamentId((prev) => prev || list[0].id);
        }
      } catch {
        if (!cancelled) toast.error("No pudimos cargar los torneos.");
      } finally {
        if (!cancelled) setLoadingTournaments(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          ...(type === "POSITION" ? { position } : {}),
          value: value.trim() || null,
          maxClaims: maxClaims ? Number(maxClaims) : null,
          sponsorId: null, // el servidor lo fija con la sesión del patrocinador
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo crear el premio.");
        return;
      }
      toast.success("Premio creado");
      setName("");
      setValue("");
      setMaxClaims("");
      router.refresh();
    } catch {
      toast.error("No se pudo crear el premio. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 min-h-11 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold";

  return (
    <Card>
      <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5" />
        Crear premio
      </h2>

      {loadingTournaments ? (
        <div className="flex items-center gap-2 text-sm text-muted py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gold" />
          Cargando torneos...
        </div>
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay torneos disponibles para adjuntar premios.</p>
      ) : (
        <form onSubmit={createPrize} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
              Torneo
            </label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className={inputClass}
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
              Nombre del premio
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Skin legendaria, boleta, etc."
              className={inputClass}
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
              Tipo
            </label>
            <div className="flex gap-1 bg-background border border-border rounded-xl p-1">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex-1 px-3 py-2.5 min-h-10 rounded-lg text-sm font-bold transition-colors ${
                    type === opt.value
                      ? "bg-gold text-background"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {type === "POSITION" && (
            <div>
              <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
                Puesto
              </label>
              <div className="flex gap-1 bg-background border border-border rounded-xl p-1">
                {positionOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPosition(p)}
                    className={`flex-1 px-3 py-2.5 min-h-10 rounded-lg text-sm font-bold transition-colors ${
                      position === p
                        ? "bg-gold text-background"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {p}.º
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
                Valor
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="$500 o detalle"
                className={inputClass}
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-xs text-muted font-bold uppercase tracking-wider mb-1.5">
                Tope de entregas
              </label>
              <input
                type="number"
                min={1}
                value={maxClaims}
                onChange={(e) => setMaxClaims(e.target.value)}
                placeholder="Ilimitado"
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim() || !tournamentId}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-12 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Crear premio
          </button>
        </form>
      )}
    </Card>
  );
}
