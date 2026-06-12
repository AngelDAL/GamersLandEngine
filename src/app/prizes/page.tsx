import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function PrizesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const userId = session.user.id;

  const [claimedPrizes, myPrizes] = await Promise.all([
    prisma.prizeClaim.findMany({
      where: { userId },
      include: {
        prize: {
          include: {
            tournament: { select: { id: true, name: true, game: true } },
            sponsor: { select: { username: true } },
          },
        },
        clerk: { select: { username: true } },
      },
      orderBy: { claimedAt: "desc" },
    }),
    prisma.prize.findMany({
      where: {
        tournament: {
          registrations: { some: { userId } },
          status: "COMPLETED",
        },
        claims: { none: { userId } },
      },
      include: {
        tournament: { select: { id: true, name: true, game: true } },
        sponsor: { select: { username: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Premios</h1>
      <p className="text-muted text-sm mb-8">Premios disponibles y reclamados</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Disponibles ({myPrizes.length})</h2>
          {myPrizes.length === 0 ? (
            <p className="text-muted text-sm">No tienes premios disponibles</p>
          ) : (
            <div className="space-y-2">
              {myPrizes.map((p) => (
                <div key={p.id} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.tournament.name} — {p.value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Reclamados ({claimedPrizes.length})</h2>
          {claimedPrizes.length === 0 ? (
            <p className="text-muted text-sm">Sin premios reclamados aún</p>
          ) : (
            <div className="space-y-2">
              {claimedPrizes.map((c) => (
                <div key={c.id} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{c.prize.name}</p>
                  <p className="text-xs text-muted">{c.prize.tournament.name} — {c.prize.value}</p>
                  <p className="text-[10px] text-muted">Entregado por: {c.clerk.username}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
