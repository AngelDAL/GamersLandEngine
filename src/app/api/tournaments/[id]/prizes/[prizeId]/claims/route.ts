import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SPONSOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { prizeId } = await params;
  const { userId, notes } = await req.json();

  const existing = await prisma.prizeClaim.findUnique({
    where: { prizeId_userId: { prizeId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "El jugador ya reclamó este premio" }, { status: 409 });
  }

  const prize = await prisma.prize.findUnique({ where: { id: prizeId }, select: { maxClaims: true } });
  if (prize?.maxClaims) {
    const count = await prisma.prizeClaim.count({ where: { prizeId } });
    if (count >= prize.maxClaims) {
      return NextResponse.json({ error: "Límite de reclamos alcanzado" }, { status: 400 });
    }
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
