"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";

type Props = {
  tournamentId: string;
  users: { id: string; username: string; avatarUrl: string | null }[];
  registeredUserIds: string[];
};

type RowState = "loading" | "ok" | string;

export function RegisterClient({ tournamentId, users, registeredUserIds }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const alreadyRegistered = new Set(registeredUserIds);
  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const registerPlayer = async (userId: string) => {
    setRows((prev) => ({ ...prev, [userId]: "loading" }));
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setRows((prev) => ({ ...prev, [userId]: "ok" }));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setRows((prev) => ({ ...prev, [userId]: data.error || "Error al inscribir" }));
      }
    } catch {
      setRows((prev) => ({ ...prev, [userId]: "Error de conexión" }));
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar jugador por username..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 bg-background border border-border rounded text-foreground placeholder-muted focus:outline-none focus:border-gold"
        autoFocus
      />

      <Card>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filtered.map((user) => {
            const state = rows[user.id];
            const registered = alreadyRegistered.has(user.id);
            return (
              <div key={user.id} className="flex items-center justify-between gap-2 py-2 px-3 hover:bg-background rounded transition-colors">
                <span className="text-sm font-medium truncate">{user.username}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {state === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400">
                      <Check className="w-4 h-4" /> Inscrito
                    </span>
                  ) : state && state !== "loading" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 max-w-[180px]">
                      <X className="w-4 h-4 shrink-0" /> {state}
                    </span>
                  ) : registered ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
                      <Check className="w-4 h-4" /> Ya inscrito
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => registerPlayer(user.id)}
                      disabled={state === "loading"}
                      className="min-h-[40px]"
                    >
                      {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-muted text-sm text-center py-4">Sin resultados</p>}
        </div>
      </Card>
    </div>
  );
}
