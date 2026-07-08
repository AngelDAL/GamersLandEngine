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
  const { matchId, slot, participantId } = body;

  if (!matchId || !slot || !participantId) {
    return NextResponse.json({ error: "Faltan parámetros: matchId, slot, participantId" }, { status: 400 });
  }

  if (slot !== "team1" && slot !== "team2") {
    return NextResponse.json({ error: "slot debe ser 'team1' o 'team2'" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: { select: { tournamentId: true } } },
  });

  if (!match || match.round.tournamentId !== id) {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  const updateData = slot === "team1" ? { team1Id: participantId } : { team2Id: participantId };
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { matchId, slot } = body;

  if (!matchId || !slot) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const updateData = slot === "team1" ? { team1Id: null } : { team2Id: null };
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
