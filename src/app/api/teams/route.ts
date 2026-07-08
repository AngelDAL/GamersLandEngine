import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { name, captainId } = await req.json();

  const team = await prisma.team.create({
    data: {
      name,
      captainId: captainId || session.user.id,
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: captainId || session.user.id,
      teamId: team.id,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(team, { status: 201 });
}

export async function GET() {
  const teams = await prisma.team.findMany({
    include: {
      captain: { select: { id: true, username: true } },
      members: { include: { user: { select: { id: true, username: true } } } },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });

  return NextResponse.json(teams);
}
