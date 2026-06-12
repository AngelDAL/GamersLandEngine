import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { id: true, username: true, avatarUrl: true },
    orderBy: { username: "asc" },
  });

  const playerIds = players.map((p) => p.id);

  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: { in: playerIds }, status: "ACTIVE" },
    select: { userId: true },
  });

  const inTeamIds = new Set(teamMembers.map((m) => m.userId));
  const freeAgents = players.filter((p) => !inTeamIds.has(p.id));

  return NextResponse.json(freeAgents);
}
