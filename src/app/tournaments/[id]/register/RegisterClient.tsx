"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  tournamentId: string;
  users: { id: string; username: string; avatarUrl: string | null }[];
};

export function RegisterClient({ tournamentId, users }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const registerPlayer = async (userId: string) => {
    setLoading(userId);
    await fetch(`/api/tournaments/${tournamentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setLoading(null);
    router.refresh();
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
          {filtered.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2 px-3 hover:bg-background rounded transition-colors">
              <span className="text-sm font-medium">{user.username}</span>
              <Button size="sm" variant="outline" onClick={() => registerPlayer(user.id)} disabled={loading === user.id}>
                {loading === user.id ? "..." : "Registrar"}
              </Button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted text-sm text-center py-4">Sin resultados</p>}
        </div>
      </Card>
    </div>
  );
}
