import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Swords, Users, Plus, ExternalLink, ArrowRight } from "lucide-react";

export default async function OrganizerDashboard() {
  const session = await auth();
  if (!session || (session.user.role !== "ORGANIZER" && session.user.role !== "ADMIN")) {
    redirect("/auth/login");
  }

  const tournaments = await prisma.tournament.findMany({
    where: session.user.role === "ORGANIZER"
      ? { organizers: { some: { userId: session.user.id } } }
      : {},
    include: {
      _count: { select: { registrations: true } },
      rounds: { take: 1, orderBy: { roundNumber: "desc" } },
    },
    orderBy: { eventDate: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Swords className="w-8 h-8 text-gold" />
            Panel del Organizador
          </h1>
          <p className="text-muted text-sm mt-1">Gestiona tus torneos asignados</p>
        </div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover"
        >
          <Plus className="w-4 h-4" />
          VER TORNEOS
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <Card className="p-10 text-center">
          <Calendar className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gold mb-2">Sin torneos asignados</h2>
          <p className="text-muted text-sm mb-4">
            El administrador te asignará torneos para gestionar
          </p>
          <Link href="/tournaments" className="text-gold hover:underline text-sm">
            Ver torneos disponibles →
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}/manage`}>
              <Card className="p-5 hover:border-gold/50 transition-all group h-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-foreground group-hover:text-gold transition-colors">{t.name}</h3>
                  <ExternalLink className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="default">{t.game.replace(/_/g, " ")}</Badge>
                  <Badge variant={t.status === "IN_PROGRESS" ? "green" : "default"}>
                    {t.status === "OPEN_REGISTRATION" ? "Abierto" : t.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {t._count.registrations} registros
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(t.eventDate).toLocaleDateString("es-MX")}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
