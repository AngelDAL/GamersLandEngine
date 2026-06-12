import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default async function TeamsPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const teams = await prisma.team.findMany({
    include: {
      captain: { select: { id: true, username: true } },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { name: "asc" },
  });

  const isCaptainOrAdmin = session.user.role === "ADMIN";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gold">Equipos</h1>
        <Link
          href="/teams/create"
          className="px-4 py-2 bg-gold text-background font-bold rounded text-sm hover:bg-gold-hover"
        >
          + Crear Equipo
        </Link>
      </div>

      {teams.length === 0 ? (
        <p className="text-muted text-center py-12">No hay equipos registrados</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className="flex items-center justify-between p-4 hover:border-gold/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                    {team.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted">
                      {team._count.members} miembros · Capitán: {team.captain.username}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
