import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prizes = await prisma.prize.findMany({
    where: { tournamentId: id },
    include: { sponsor: { select: { id: true, username: true } } },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(prizes);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  const prize = await prisma.prize.create({
    data: {
      tournamentId: id,
      name: data.name,
      description: data.description,
      type: data.type,
      position: data.position,
      value: data.value,
      sponsorId: data.sponsorId,
      imageUrl: data.imageUrl,
      maxClaims: data.maxClaims,
    },
  });

  return NextResponse.json(prize, { status: 201 });
}
