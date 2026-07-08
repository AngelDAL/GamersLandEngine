import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  return 1 << (32 - Math.clz32(n - 1));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const numSlots = nextPowerOf2(body.numSlots || 2);

  // Delete existing rounds
  await prisma.tournamentRound.deleteMany({ where: { tournamentId: id } });

  const numRounds = Math.log2(numSlots);
  const createdRounds: any[] = [];

  for (let r = 1; r <= numRounds; r++) {
    const matchCount = numSlots / Math.pow(2, r);
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: id, roundNumber: r },
    });

    for (let i = 0; i < matchCount; i++) {
      await prisma.match.create({
        data: {
          roundId: round.id,
          bracketPosition: i,
          status: "PENDING",
        },
      });
    }

    createdRounds.push(round);
  }

  return NextResponse.json({ rounds: createdRounds, numSlots, numRounds }, { status: 201 });
}
