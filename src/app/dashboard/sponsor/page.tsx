import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SponsorScanClient } from "./SponsorScanClient";
import { SponsorPrizeCreateClient } from "./SponsorPrizeCreateClient";
import { Gift, ScanLine, Trophy, ArrowRight } from "lucide-react";

export default async function SponsorDashboard() {
  const session = await auth();
  if (!session || (session.user.role !== "SPONSOR" && session.user.role !== "ADMIN")) {
    redirect("/auth/login");
  }

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

      {/* Índice de acceso rápido */}
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        <a
          href="#escanear"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-gold/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Escanear jugador</p>
            <p className="text-xs text-muted">Entrega premios con su nombre o código QR</p>
          </div>
        </a>
        <a
          href="#mis-premios"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-gold/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Mis premios</p>
            <p className="text-xs text-muted">{myPrizes.length} creados · {totalClaimed} entregados</p>
          </div>
        </a>
      </div>

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
          <p className="text-muted text-sm">Con entregas disponibles</p>
          <p className="text-2xl font-bold text-foreground">
            {myPrizes.filter((p) => p._count.claims < (p.maxClaims ?? Infinity)).length}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div id="escanear" className="scroll-mt-24">
          <SponsorScanClient sponsorId={session.user.id} />
        </div>

        <div className="space-y-6">
          <SponsorPrizeCreateClient />

          <div id="mis-premios" className="scroll-mt-24">
            <Card>
              <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5" />
                Mis Premios
              </h2>
              {myPrizes.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
                  <p className="text-muted text-sm mb-4">
                    Aún no has creado premios. Usa el formulario de arriba para crear el primero.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {myPrizes.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted truncate">
                          {p.tournament.name}
                          {p.position ? ` · ${p.position}.º puesto` : ""}
                          {p.value ? ` · ${p.value}` : ""}
                        </p>
                      </div>
                      <span className="text-sm text-muted shrink-0">
                        {p._count.claims}{p.maxClaims ? ` / ${p.maxClaims}` : ""} entregados
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
          Ver torneos de la plataforma <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
