import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { matchId } = await params;
  const body = await req.json();
  const { type, userId, teamId, result, score, stats } = body;

  if (type === "player") {
    const existing = await prisma.matchResult.findFirst({
      where: { matchId, userId },
    });
    if (existing) {
      await prisma.matchResult.update({
        where: { id: existing.id },
        data: { result, score, stats },
      });
    } else {
      await prisma.matchResult.create({
        data: { matchId, userId, teamId, result, score, stats },
      });
    }
  } else if (type === "team") {
    const existing = await prisma.teamMatchResult.findFirst({
      where: { matchId, teamId },
    });
    if (existing) {
      await prisma.teamMatchResult.update({
        where: { id: existing.id },
        data: { result, score },
      });
    } else {
      await prisma.teamMatchResult.create({
        data: { matchId, teamId, result, score },
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const [playerResults, teamResults] = await Promise.all([
    prisma.matchResult.findMany({
      where: { matchId },
      include: { user: { select: { id: true, username: true } } },
    }),
    prisma.teamMatchResult.findMany({
      where: { matchId },
      include: { team: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({ playerResults, teamResults });
}
