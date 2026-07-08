import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { matchCount } = body;

  if (!matchCount || matchCount < 1) {
    return NextResponse.json({ error: "Se requiere matchCount mínimo 1" }, { status: 400 });
  }

  // Get the highest round number
  const lastRound = await prisma.tournamentRound.findFirst({
    where: { tournamentId: id },
    orderBy: { roundNumber: "desc" },
  });

  const roundNumber = (lastRound?.roundNumber || 0) + 1;

  const round = await prisma.tournamentRound.create({
    data: { tournamentId: id, roundNumber },
  });

  for (let i = 0; i < matchCount; i++) {
    await prisma.match.create({
      data: { roundId: round.id, bracketPosition: i, status: "PENDING" },
    });
  }

  return NextResponse.json({ round, matchCount }, { status: 201 });
}
