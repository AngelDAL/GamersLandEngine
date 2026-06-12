import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateSingleElimination, generateDoubleElimination, generateRoundRobin } from "@/lib/bracket-engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      tournamentTeams: { include: { team: { select: { id: true, name: true } } } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  let contestants: { id: string; name: string }[];

  if (tournament.isTeamBased) {
    // Team-based: use registered teams
    contestants = tournament.tournamentTeams.map((tt) => ({
      id: tt.team.id,
      name: tt.team.name,
    }));
  } else {
    // Individual: use registered players directly (all statuses since they're all valid)
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: id },
      include: { user: { select: { id: true, username: true } } },
    });
    contestants = registrations.map((r) => ({
      id: r.user.id,
      name: r.user.username,
    }));
  }

  if (contestants.length < 2) {
    return NextResponse.json({
      error: tournament.isTeamBased
        ? "Se necesitan al menos 2 equipos"
        : "Se necesitan al menos 2 jugadores",
    }, { status: 400 });
  }

  // Delete existing rounds
  await prisma.tournamentRound.deleteMany({ where: { tournamentId: id } });

  let bracket: { round: number; position: number; team1Id: string | null; team2Id: string | null }[][];

  switch (tournament.bracketType) {
    case "DOUBLE_ELIMINATION": {
      const { upper, final } = generateDoubleElimination(contestants);
      bracket = [...upper, ...final];
      break;
    }
    case "ROUND_ROBIN":
      bracket = generateRoundRobin(contestants);
      break;
    default:
      bracket = generateSingleElimination(contestants);
  }

  const createdRounds: any[] = [];
  for (const roundMatches of bracket) {
    const createdRound = await prisma.tournamentRound.create({
      data: { tournamentId: id, roundNumber: createdRounds.length + 1 },
    });

    for (const m of roundMatches) {
      await prisma.match.create({
        data: {
          roundId: createdRound.id,
          team1Id: m.team1Id,
          team2Id: m.team2Id,
          bracketPosition: m.position,
        },
      });
    }

    createdRounds.push(createdRound);
  }

  await prisma.tournament.update({
    where: { id },
    data: { status: "IN_PROGRESS" },
  });

  return NextResponse.json({ rounds: createdRounds }, { status: 201 });
}
