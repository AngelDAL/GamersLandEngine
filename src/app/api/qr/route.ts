import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Código QR requerido" }, { status: 400 });
  }

  // code can be: userId (direct lookup) or userId-signature (scanned QR)
  const parts = code.split("-");
  const userId = parts[0];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      registrations: {
        include: {
          tournament: { select: { id: true, name: true, game: true, status: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      matchResults: {
        include: {
          match: {
            include: {
              round: {
                include: { tournament: { select: { id: true, name: true, game: true } } },
              },
            },
          },
        },
        orderBy: { match: { round: { roundNumber: "desc" } } },
        take: 20,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const isSponsorOrAdmin = session.user.role === "SPONSOR" || session.user.role === "ADMIN";

  let availablePrizes: any[] = [];
  if (isSponsorOrAdmin) {
    availablePrizes = await prisma.prize.findMany({
      where: {
        tournamentId: { in: user.registrations.map((r) => r.tournamentId) },
        OR: [
          { sponsorId: session.user.role === "SPONSOR" ? session.user.id : undefined },
          { sponsorId: session.user.role === "ADMIN" ? undefined : null },
        ],
      },
      include: {
        tournament: { select: { id: true, name: true } },
        _count: { select: { claims: true } },
      },
    });

    // Filter out already claimed
    const claimedIds = (
      await prisma.prizeClaim.findMany({
        where: { userId: user.id },
        select: { prizeId: true },
      })
    ).map((c) => c.prizeId);

    availablePrizes = availablePrizes.filter((p) => !claimedIds.includes(p.id));
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    tournaments: user.registrations.map((r) => ({
      tournament: r.tournament,
      team: r.team,
      status: r.status,
    })),
    matchHistory: user.matchResults.map((r) => ({
      result: r.result,
      score: r.score,
      tournament: r.match.round.tournament.name,
      game: r.match.round.tournament.game,
    })),
    availablePrizes,
  });
}
