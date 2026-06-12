import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const game = searchParams.get("game");

  const where: any = {};
  if (status) where.status = status;
  if (game) where.game = game;

  const tournaments = await prisma.tournament.findMany({
    where,
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { registrations: true, rounds: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  return NextResponse.json(tournaments);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "ORGANIZER") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const data = await req.json();
  const tournament = await prisma.tournament.create({
    data: {
      name: data.name,
      game: data.game,
      description: data.description,
      entryFee: data.entryFee,
      maxTeams: data.maxTeams,
      minTeams: data.minTeams,
      isTeamBased: data.isTeamBased ?? true,
      bracketType: data.bracketType,
      eventDate: new Date(data.eventDate),
      registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
      location: data.location,
      rules: data.rules,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(tournament, { status: 201 });
}
