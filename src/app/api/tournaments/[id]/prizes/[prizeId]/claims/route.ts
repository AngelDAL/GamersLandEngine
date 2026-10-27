import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type PrizeWithTournament = {
  id: string;
  tournamentId: string;
  position: number | null;
  maxClaims: number | null;
  sponsorId: string | null;
};

// Determine if user actually earned a specific prize based on position
async function userEarnedPrize(userId: string, prize: PrizeWithTournament): Promise<boolean> {
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

const claimSchema = z.object({
  userId: z.string().min(1, "Falta el jugador"),
  notes: z.string().max(1000).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SPONSOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, prizeId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const { userId, notes } = parsed.data;

  const prize = await prisma.prize.findUnique({
    where: { id: prizeId },
    include: { tournament: { select: { id: true } } },
  });
  // El premio debe pertenecer al torneo de la URL
  if (!prize || prize.tournamentId !== id) {
    return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });
  }

  // Scoping de patrocinador: solo sus propios premios o los sin patrocinador
  // asignado (coincide con lo que /api/qr les muestra como disponibles).
  if (session.user.role === "SPONSOR" && prize.sponsorId !== null && prize.sponsorId !== session.user.id) {
    return NextResponse.json(
      { error: "Este premio pertenece a otro patrocinador" },
      { status: 403 },
    );
  }

  const earned = await userEarnedPrize(userId, prize);
  if (!earned) {
    return NextResponse.json(
      { error: "Este jugador no cumple con la posición requerida para este premio" },
      { status: 403 },
    );
  }

  try {
    // Transacción: el conteo y la creación van juntos para evitar que dos
    // entregas simultáneas rebasen maxClaims.
    const claim = await prisma.$transaction(async (tx) => {
      if (prize.maxClaims != null) {
        const count = await tx.prizeClaim.count({ where: { prizeId } });
        if (count >= prize.maxClaims) {
          return null;
        }
      }
      return tx.prizeClaim.create({
        data: { prizeId, userId, claimedBy: session.user.id, notes: notes ?? null },
      });
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Este premio ya alcanzó su límite de entregas" },
        { status: 409 },
      );
    }
    return NextResponse.json(claim, { status: 201 });
  } catch {
    // El unique (prizeId, userId) significa que ya lo reclamó
    return NextResponse.json(
      { error: "El jugador ya reclamó este premio" },
      { status: 409 },
    );
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const { id, prizeId } = await params;

  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize || prize.tournamentId !== id) {
    return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });
  }

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
