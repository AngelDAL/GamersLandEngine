import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");

  const where: any = { userId };
  if (game) where.match = { round: { tournament: { game } } };

  const results = await prisma.matchResult.findMany({
    where,
    include: {
      match: {
        include: {
          round: {
            include: {
              tournament: { select: { id: true, name: true, game: true } },
            },
          },
          winner: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { match: { round: { roundNumber: "desc" } } },
    take: 50,
  });

  const stats = {
    total: results.length,
    wins: results.filter((r) => r.result === "WON").length,
    losses: results.filter((r) => r.result === "LOST").length,
    winRate: results.length > 0
      ? Math.round((results.filter((r) => r.result === "WON").length / results.length) * 100)
      : 0,
  };

  return NextResponse.json({ results, stats });
}
