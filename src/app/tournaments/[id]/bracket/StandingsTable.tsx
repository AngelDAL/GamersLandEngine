"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy } from "lucide-react";

type StandingRow = {
  participantId: string;
  name: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
};

type Props = {
  tournamentId: string;
  /** Se incrementa cuando la llave cambia por socket: reconsulta la tabla. */
  refreshKey?: number;
};

/**
 * Tabla de posiciones del round-robin (PJ/G/E/P, GF/GC y Pts 3/1/0).
 * Se alimenta del endpoint `GET /api/tournaments/[id]/standings`.
 */
export function StandingsTable({ tournamentId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/standings`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (alive) setError(data.error || "No se pudo cargar la tabla");
          return;
        }
        const data = await res.json();
        if (alive) {
          setRows(data.standings ?? []);
          setError("");
        }
      } catch {
        if (alive) setError("Error de conexión al cargar la tabla");
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [tournamentId, refreshKey]);

  return (
    <Card className="mb-6 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-gold" />
        <h2 className="text-sm font-black text-gold uppercase tracking-widest">Tabla de posiciones</h2>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!rows && !error && (
        <div className="flex items-center gap-2 text-xs text-muted py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando tabla...
        </div>
      )}

      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[460px]">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left py-2 pr-2 font-semibold">#</th>
                <th className="text-left py-2 pr-2 font-semibold">Participante</th>
                <th className="text-center py-2 px-1 font-semibold" title="Partidos jugados">PJ</th>
                <th className="text-center py-2 px-1 font-semibold" title="Ganados">G</th>
                <th className="text-center py-2 px-1 font-semibold" title="Empatados">E</th>
                <th className="text-center py-2 px-1 font-semibold" title="Perdidos">P</th>
                <th className="text-center py-2 px-1 font-semibold" title="Goles a favor">GF</th>
                <th className="text-center py-2 px-1 font-semibold" title="Goles en contra">GC</th>
                <th className="text-center py-2 pl-1 font-semibold" title="Puntos">Pts</th>
              </tr>
            </thead>
            <tbody className="max-h-[320px] overflow-y-auto">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted">
                    Aún no hay participantes en la tabla
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.participantId} className={`border-b border-border/50 ${i === 0 && r.pj > 0 ? "text-gold" : "text-foreground"}`}>
                  <td className="py-2 pr-2 font-bold">{i + 1}</td>
                  <td className="py-2 pr-2 truncate max-w-[180px]">{r.name}</td>
                  <td className="text-center py-2 px-1">{r.pj}</td>
                  <td className="text-center py-2 px-1">{r.g}</td>
                  <td className="text-center py-2 px-1">{r.e}</td>
                  <td className="text-center py-2 px-1">{r.p}</td>
                  <td className="text-center py-2 px-1">{r.gf}</td>
                  <td className="text-center py-2 px-1">{r.gc}</td>
                  <td className="text-center py-2 pl-1 font-black">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
