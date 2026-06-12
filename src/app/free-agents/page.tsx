import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export default async function FreeAgentsPage() {
  const players = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { id: true, username: true, avatarUrl: true },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Agentes Libres</h1>
      <p className="text-muted text-sm mb-8">Jugadores disponibles para ser reclutados en equipos</p>

      <div className="grid gap-3 md:grid-cols-2">
        {players.map((p) => (
          <Card key={p.id} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm">
              {p.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{p.username}</p>
              <p className="text-xs text-muted">Jugador</p>
            </div>
          </Card>
        ))}
        {players.length === 0 && <p className="text-muted text-center col-span-2 py-8">No hay agentes libres disponibles</p>}
      </div>
    </div>
  );
}
