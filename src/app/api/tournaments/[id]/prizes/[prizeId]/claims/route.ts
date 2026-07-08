import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Determine if user actually earned a specific prize based on position
async function userEarnedPrize(userId: string, prize: any): Promise<boolean> {
  if (!prize.position) return true; // participation prize

  const tournamentId = prize.tournamentId;
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  });
  if (rounds.length === 0) return false;
  const maxRound = rounds[0].roundNumber;

  const userResults = await prisma.matchResult.findMany({
    where: { userId, match: { round: { tournamentId } } },
    select: { result: true, match: { select: { round: { select: { roundNumber: true } } } } },
    orderBy: { match: { round: { roundNumber: "desc" } } },
    take: 5,
  });
  if (userResults.length === 0) return false;

  const finalResult = userResults[0];
  const finalRound = finalResult.match.round.roundNumber;

  if (prize.position === 1) return finalRound === maxRound && finalResult.result === "WON";
  if (prize.position === 2) return finalRound === maxRound && finalResult.result === "LOST";
  if (prize.position === 3) {
    const regCount = await prisma.tournamentRegistration.count({
      where: { tournamentId, status: "CONFIRMED" },
    });
    return regCount >= 4 && finalRound === maxRound - 1 && finalResult.result === "LOST";
  }
  return false;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SPONSOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { prizeId } = await params;
  const { userId, notes } = await req.json();

  const prize = await prisma.prize.findUnique({
    where: { id: prizeId },
    include: { tournament: { select: { id: true } } },
  });
  if (!prize) return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });

  const earned = await userEarnedPrize(userId, prize);
  if (!earned) {
    return NextResponse.json({ error: "Este jugador no cumple con la posición requerida para este premio" }, { status: 403 });
  }

  const existing = await prisma.prizeClaim.findUnique({
    where: { prizeId_userId: { prizeId, userId } },
  });
  if (existing) return NextResponse.json({ error: "El jugador ya reclamó este premio" }, { status: 409 });

  if (prize?.maxClaims) {
    const count = await prisma.prizeClaim.count({ where: { prizeId } });
    if (count >= prize.maxClaims) return NextResponse.json({ error: "Límite alcanzado" }, { status: 400 });
  }

  const claim = await prisma.prizeClaim.create({
    data: { prizeId, userId, claimedBy: session.user.id, notes },
  });
  return NextResponse.json(claim, { status: 201 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const { prizeId } = await params;
  const claims = await prisma.prizeClaim.findMany({
    where: { prizeId },
    include: {
      user: { select: { id: true, username: true } },
      clerk: { select: { id: true, username: true } },
    },
    orderBy: { claimedAt: "desc" },
  });
  return NextResponse.json(claims);
}
