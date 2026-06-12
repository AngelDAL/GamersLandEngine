import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  Users, MapPin, DollarSign, Trophy, Gamepad2, Calendar,
  Sword, Crosshair, Zap, Target,
} from "lucide-react";

const gameConfig: Record<string, { icon: typeof Gamepad2; gradient: string; label: string }> = {
  LEAGUE_OF_LEGENDS: { icon: Sword, gradient: "from-blue-900/80 via-blue-800/40 to-transparent", label: "League of Legends" },
  VALORANT: { icon: Crosshair, gradient: "from-red-900/80 via-red-800/40 to-transparent", label: "Valorant" },
  FORTNITE: { icon: Zap, gradient: "from-purple-900/80 via-purple-800/40 to-transparent", label: "Fortnite" },
  LOL_1V1: { icon: Target, gradient: "from-amber-900/80 via-amber-800/40 to-transparent", label: "LoL 1v1" },
};

export default async function HomePage() {
  const session = await auth();
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["OPEN_REGISTRATION", "IN_PROGRESS"] } },
    include: {
      createdBy: { select: { username: true } },
      prizes: { where: { position: 1 }, take: 1 },
      _count: { select: { registrations: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mini header */}
      <div className="border-b border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-gold" />
              Torneos disponibles
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {tournaments.length} torneo{tournaments.length !== 1 ? "s" : ""} activo{tournaments.length !== 1 ? "s" : ""}
            </p>
          </div>
          {session && (
            <Link
              href={`/dashboard/${session.user.role.toLowerCase()}`}
              className="text-xs text-gold hover:underline"
            >
              Ir al Dashboard
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {tournaments.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-muted mx-auto mb-4 opacity-30" />
            <p className="text-muted text-lg font-medium">No hay torneos activos en este momento</p>
            <p className="text-muted text-sm mt-1">Vuelve pronto para ver las próximas competencias</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => {
              const game = gameConfig[t.game] || gameConfig.LEAGUE_OF_LEGENDS;
              const Icon = game.icon;
              const topPrize = t.prizes[0];

              return (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="group">
                  <div className="bg-surface border border-border rounded-xl overflow-hidden hover:border-gold/50 hover:shadow-xl hover:shadow-gold/5 transition-all duration-200 h-full flex flex-col">
                    {/* Game banner */}
                    <div className={`relative h-28 bg-gradient-to-br ${game.gradient} flex items-end p-4`}>
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
                      <div className="relative flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white font-bold text-sm drop-shadow-lg">{game.label}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-foreground group-hover:text-gold transition-colors">
                          {t.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                          t.status === "OPEN_REGISTRATION"
                            ? "text-green-400 bg-green-500/10 border-green-500/30"
                            : "text-blue-400 bg-blue-500/10 border-blue-500/30"
                        }`}>
                          {t.status === "OPEN_REGISTRATION" ? "Abierto" : "En vivo"}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted flex-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {t._count.registrations} / {t.maxTeams} registrados
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(t.eventDate).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short",
                          })}
                        </div>
                        {t.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {t.location}
                          </div>
                        )}
                      </div>

                      {/* Bottom bar */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                        <div className="flex items-center gap-1 text-gold text-xs font-bold">
                          <DollarSign className="w-3 h-3" />
                          {t.entryFee ? `$${Number(t.entryFee)}` : "Gratis"}
                        </div>
                        {topPrize && (
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <Trophy className="w-3 h-3" />
                            {topPrize.value}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {tournaments.length > 0 && (
        <div className="border-t border-border bg-surface/50">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted text-center sm:text-left">
              {tournaments.length} torneo{tournaments.length !== 1 ? "s" : ""} activo{tournaments.length !== 1 ? "s" : ""}
            </p>
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-all shadow-lg shadow-gold/20"
            >
              <Gamepad2 className="w-4 h-4" />
              VER TODOS LOS TORNEOS
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
