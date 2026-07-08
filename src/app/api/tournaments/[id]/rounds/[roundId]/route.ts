import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { roundId } = await params;

  // Delete all matches in the round first
  await prisma.match.deleteMany({ where: { roundId } });
  // Then delete the round
  await prisma.tournamentRound.delete({ where: { id: roundId } });

  return NextResponse.json({ success: true });
}
