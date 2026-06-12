import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SponsorScanClient } from "./SponsorScanClient";

export default async function SponsorDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "SPONSOR") redirect("/auth/login");

  const myPrizes = await prisma.prize.findMany({
    where: { sponsorId: session.user.id },
    include: {
      tournament: { select: { id: true, name: true } },
      _count: { select: { claims: true } },
    },
  });

  const totalClaimed = myPrizes.reduce((acc, p) => acc + p._count.claims, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Panel del Patrocinador</h1>
      <p className="text-muted text-sm mb-8">Bienvenido, {session.user.name}</p>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <p className="text-muted text-sm">Premios creados</p>
          <p className="text-2xl font-bold text-gold">{myPrizes.length}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm">Premios reclamados</p>
          <p className="text-2xl font-bold text-blue-accent">{totalClaimed}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm">En este evento</p>
          <p className="text-2xl font-bold text-foreground">
            {myPrizes.filter((p) => p._count.claims < (p.maxClaims ?? Infinity)).length} disponibles
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SponsorScanClient sponsorId={session.user.id} />

        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Mis Premios</h2>
          {myPrizes.length === 0 ? (
            <p className="text-muted text-sm">No has creado premios aún. Contacta al admin.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {myPrizes.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted">{p.tournament.name}</p>
                  </div>
                  <span className="text-sm text-muted">
                    {p._count.claims}{p.maxClaims ? ` / ${p.maxClaims}` : ""} reclamados
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
