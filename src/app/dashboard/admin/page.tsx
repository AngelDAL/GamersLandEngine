import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Trophy, Users, Gamepad2, Plus, Settings, BarChart3,
  Calendar, Swords, ExternalLink, ArrowRight,
} from "lucide-react";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/auth/login");

  const [totalTournaments, activeTournaments, totalUsers, totalPlayers, recentTournaments] = await Promise.all([
    prisma.tournament.count(),
    prisma.tournament.count({ where: { status: "IN_PROGRESS" } }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "PLAYER" } }),
    prisma.tournament.findMany({
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Settings className="w-8 h-8 text-gold" />
            Panel Administrativo
          </h1>
          <p className="text-muted text-sm mt-1">Control total del evento</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tournaments/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-all shadow-lg shadow-gold/20"
          >
            <Plus className="w-4 h-4" />
            CREAR TORNEO
          </Link>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold text-gold font-bold rounded-xl text-sm hover:bg-gold/10 transition-all"
          >
            VER TODOS
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-10">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-gold" />
            </div>
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Total Torneos</span>
          </div>
          <p className="text-3xl font-black text-foreground">{totalTournaments}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Swords className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs text-muted uppercase tracking-wider font-bold">En Curso</span>
          </div>
          <p className="text-3xl font-black text-blue-400">{activeTournaments}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Usuarios</span>
          </div>
          <p className="text-3xl font-black text-foreground">{totalUsers}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Jugadores</span>
          </div>
          <p className="text-3xl font-black text-foreground">{totalPlayers}</p>
        </Card>
      </div>

      {/* Torneos Recientes */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Torneos Recientes
          </h2>
          <Link href="/tournaments" className="text-xs text-gold hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentTournaments.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay torneos aún</p>
            <Link href="/tournaments/create" className="text-gold hover:underline text-sm mt-1 inline-block">
              Crear el primer torneo
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}/manage`}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-background transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    t.status === "OPEN_REGISTRATION" ? "bg-green-400" :
                    t.status === "IN_PROGRESS" ? "bg-blue-400" :
                    t.status === "COMPLETED" ? "bg-muted" : "bg-yellow-400"
                  }`} />
                  <div>
                    <p className="font-medium text-sm group-hover:text-gold transition-colors">{t.name}</p>
                    <p className="text-xs text-muted">
                      {t._count.registrations} registros · {t.game.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
