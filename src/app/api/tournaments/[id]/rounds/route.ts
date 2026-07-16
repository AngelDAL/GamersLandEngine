import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  type BracketMatchDef,
} from "@/lib/bracket-engine";
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
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id },
        include: { user: { select: { id: true, username: true } } },
      });
      const userMap = new Map(registrations.map((r) => [r.user.id, r.user.username]));
      const active = slotOrder.filter((id): id is string => id !== null);
      if (active.length < 2) {
        return NextResponse.json({ error: "Se necesitan al menos 2 jugadores asignados" }, { status: 400 });
      }
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

  // Delete existing rounds and matches
  await prisma.match.deleteMany({ where: { round: { tournamentId: id } } });
  await prisma.tournamentRound.deleteMany({ where: { tournamentId: id } });

  // Generate bracket
  let matchDefs: BracketMatchDef[];

  if (slotOrder && !tournament.isTeamBased) {
    // Manual bracket from slot positions
    const totalSlots = slotOrder.length;
    const numRounds = Math.log2(totalSlots);
    const defs: BracketMatchDef[] = [];

    // Round 1
    const round1Count = totalSlots / 2;
    for (let p = 0; p < round1Count; p++) {
      const t1 = contestants[p * 2]?.id?.startsWith("__bye__") ? null : contestants[p * 2]?.id || null;
      const t2 = contestants[p * 2 + 1]?.id?.startsWith("__bye__") ? null : contestants[p * 2 + 1]?.id || null;
      defs.push({
        roundNumber: 1,
        bracketPosition: p,
        phase: "UPPER",
        team1Id: t1,
        team2Id: t2,
        winnerNextMatchIdx: -1,
        winnerNextSlot: 1,
        loserNextMatchIdx: -1,
        loserNextSlot: 1,
      });
    }

    // Subsequent rounds
    for (let r = 2; r <= numRounds; r++) {
      const matchCount = totalSlots / Math.pow(2, r);
      for (let p = 0; p < matchCount; p++) {
        defs.push({
          roundNumber: r,
          bracketPosition: p,
          phase: "UPPER",
          team1Id: null,
          team2Id: null,
          winnerNextMatchIdx: -1,
          winnerNextSlot: 1,
          loserNextMatchIdx: -1,
          loserNextSlot: 1,
        });
      }
    }

    // Set winner connections for manual bracket
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const nextIdx = defs.findIndex(x => x.roundNumber === d.roundNumber + 1 && x.bracketPosition === Math.floor(d.bracketPosition / 2));
      if (nextIdx >= 0) {
        defs[i].winnerNextMatchIdx = nextIdx;
        defs[i].winnerNextSlot = d.bracketPosition % 2 === 0 ? 1 : 2;
      }
    }

    matchDefs = defs;
  } else {
    switch (tournament.bracketType) {
      case "DOUBLE_ELIMINATION":
        matchDefs = generateDoubleElimination(contestants);
        break;
      case "ROUND_ROBIN":
        matchDefs = generateRoundRobin(contestants);
        break;
      default:
        matchDefs = generateSingleElimination(contestants);
    }
  }

  // Group match definitions by roundNumber to create TournamentRound records
  const roundGroups = new Map<number, BracketMatchDef[]>();
  for (const m of matchDefs) {
    const existing = roundGroups.get(m.roundNumber) || [];
    existing.push(m);
    roundGroups.set(m.roundNumber, existing);
  }

  // Create rounds and matches, keeping a mapping of (roundNumber, position) → match ID
  type MatchKey = string; // `${roundNumber}:${position}`
  const matchIdMap = new Map<MatchKey, string>();
  const roundIdMap = new Map<number, string>();

  for (const [roundNum, defs] of [...roundGroups.entries()].sort(([a], [b]) => a - b)) {
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: id, roundNumber: roundNum },
    });
    roundIdMap.set(roundNum, round.id);

    for (const d of defs) {
      const match = await prisma.match.create({
        data: {
          roundId: round.id,
          bracketPosition: d.bracketPosition,
          phase: d.phase,
          team1Id: d.team1Id,
          team2Id: d.team2Id,
          status: "PENDING",
        },
      });
      matchIdMap.set(`${roundNum}:${d.bracketPosition}`, match.id);
    }
  }

  // ── Set up connections ──
  // Now that all matches have IDs, we link them up.
  // Iterate through matchDefs parallel to allCreatedMatches.

  const allCreatedMatches = await prisma.match.findMany({
    where: { round: { tournamentId: id } },
    orderBy: [{ round: { roundNumber: "asc" } }, { bracketPosition: "asc" }],
  });

  // Iterate the round groups in order, matching definitions to created matches
  let matchIndex = 0;
  for (const [roundNum, defs] of [...roundGroups.entries()].sort(([a], [b]) => a - b)) {
    for (const d of defs) {
      const thisMatchId = allCreatedMatches[matchIndex]?.id;
      if (!thisMatchId) { matchIndex++; continue; }

      const updates: Record<string, any> = {};

      if (d.winnerNextMatchIdx >= 0 && d.winnerNextMatchIdx < allCreatedMatches.length) {
        updates.winnerNextMatchId = allCreatedMatches[d.winnerNextMatchIdx].id;
        updates.winnerNextSlot = d.winnerNextSlot;
      }

      if (d.loserNextMatchIdx >= 0 && d.loserNextMatchIdx < allCreatedMatches.length) {
        updates.loserNextMatchId = allCreatedMatches[d.loserNextMatchIdx].id;
        updates.loserNextSlot = d.loserNextSlot;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.match.update({
          where: { id: thisMatchId },
          data: updates,
        });
      }

      matchIndex++;
    }
  }

  // Update tournament status
  await prisma.tournament.update({
    where: { id },
    data: { status: "IN_PROGRESS" },
  });

  // Auto-register with Riot for League of Legends
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

  return NextResponse.json({ rounds: [...roundIdMap.values()] }, { status: 201 });
}
