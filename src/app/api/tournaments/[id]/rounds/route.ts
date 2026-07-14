import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateSingleElimination, generateDoubleElimination, generateRoundRobin } from "@/lib/bracket-engine";
import { ensureRiotTournament } from "@/lib/riot-integration";

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

  // Only auto-register with Riot for League of Legends tournaments. Other
  // games don't have a Riot integration.
  const isLeagueOfLegends = (tournament.game ?? "").toUpperCase() === "LEAGUE_OF_LEGENDS";

  const body = await req.json().catch(() => ({}));
  const slotOrder: (string | null)[] | undefined = body.slotOrder;

  let contestants: { id: string; name: string }[];

  if (tournament.isTeamBased) {
    contestants = tournament.tournamentTeams.map((tt) => ({
      id: tt.team.id,
      name: tt.team.name,
    }));
    if (contestants.length < 2) {
      return NextResponse.json({ error: "Se necesitan al menos 2 equipos" }, { status: 400 });
    }
  } else {
    if (slotOrder) {
      // Use the custom slot order from the organizer
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id },
        include: { user: { select: { id: true, username: true } } },
      });
      const userMap = new Map(registrations.map((r) => [r.user.id, r.user.username]));
      const active = slotOrder.filter((id): id is string => id !== null);
      if (active.length < 2) {
        return NextResponse.json({ error: "Se necesitan al menos 2 jugadores asignados" }, { status: 400 });
      }
      // Build bracket manually from slot order
      // We create contestants respecting the slot positions (null = BYE)
      contestants = slotOrder.map((id) => ({
        id: id || `__bye__${Math.random()}`,
        name: id ? (userMap.get(id) || "Jugador") : "__BYE__",
      }));
    } else {
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id },
        include: { user: { select: { id: true, username: true } } },
      });
      contestants = registrations.map((r) => ({ id: r.user.id, name: r.user.username }));
      if (contestants.length < 2) {
        return NextResponse.json({ error: "Se necesitan al menos 2 jugadores" }, { status: 400 });
      }
    }
  }

  // Delete existing rounds
  await prisma.tournamentRound.deleteMany({ where: { tournamentId: id } });

  let bracket: { round: number; position: number; team1Id: string | null; team2Id: string | null }[][];

  if (slotOrder && !tournament.isTeamBased) {
    // Manual bracket from slot positions
    const totalSlots = slotOrder.length;
    const numRounds = Math.log2(totalSlots);

    // Round 1: pair up slots
    const round1: { round: number; position: number; team1Id: string | null; team2Id: string | null }[] = [];
    for (let i = 0; i < totalSlots / 2; i++) {
      round1.push({
        round: 1,
        position: i,
        team1Id: contestants[i * 2]?.id?.startsWith("__bye__") ? null : contestants[i * 2]?.id || null,
        team2Id: contestants[i * 2 + 1]?.id?.startsWith("__bye__") ? null : contestants[i * 2 + 1]?.id || null,
      });
    }
    bracket = [round1];

    // Subsequent rounds: placeholders
    for (let r = 2; r <= numRounds; r++) {
      const matchCount = totalSlots / Math.pow(2, r);
      const round: typeof round1 = [];
      for (let i = 0; i < matchCount; i++) {
        round.push({ round: r, position: i, team1Id: null, team2Id: null });
      }
      bracket.push(round);
    }
  } else {
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

  // Auto-register with Riot so the tournament is ready to issue per-match codes.
  // This is fire-and-forget: a Riot outage shouldn't block the bracket generation,
  // but we log if something goes wrong so the organizer can re-try.
  if (isLeagueOfLegends) {
    try {
      await ensureRiotTournament(id);
    } catch (err) {
      console.error(
        `[RoundsRoute] Auto-registration with Riot failed for tournament ${id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({ rounds: createdRounds }, { status: 201 });
}
