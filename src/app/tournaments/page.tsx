import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const gameColors: Record<string, string> = {
  LEAGUE_OF_LEGENDS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  VALORANT: "bg-red-500/20 text-red-400 border-red-500/30",
  FORTNITE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  LOL_1V1: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  OPEN_REGISTRATION: "Inscripciones abiertas",
  CLOSED: "Cerrado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

export default async function TournamentsPage() {
  const session = await auth();
  const canManage = session?.user && (session.user.role === "ADMIN" || session.user.role === "ORGANIZER");

  const tournaments = await prisma.tournament.findMany({
    where: canManage ? {} : { status: { not: "DRAFT" } },
    include: {
      createdBy: { select: { username: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gold">Torneos</h1>
        {canManage && (
          <Link
            href="/tournaments/create"
            className="px-4 py-2 bg-gold text-background font-bold rounded text-sm hover:bg-gold-hover"
          >
            + Crear Torneo
          </Link>
        )}
      </div>

      {tournaments.length === 0 ? (
        <p className="text-muted text-center py-12">No hay torneos</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((t) => (
            <Link key={t.id} href={canManage ? `/tournaments/${t.id}/manage` : `/tournaments/${t.id}`}>
              <div className="bg-surface border border-border rounded-lg p-5 hover:border-gold/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-bold text-foreground">{t.name}</h2>
                  <Badge variant={t.status === "OPEN_REGISTRATION" ? "green" : t.status === "IN_PROGRESS" ? "blue" : t.status === "DRAFT" ? "default" : "default"}>
                    {statusLabels[t.status] || t.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${gameColors[t.game] || ""}`}>
                    {t.game.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted">{t._count.registrations} registrados</span>
                </div>

                <div className="flex items-center justify-between text-sm text-muted">
                  <span>{new Date(t.eventDate).toLocaleDateString("es-MX")}</span>
                  <span>por {t.createdBy.username}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
