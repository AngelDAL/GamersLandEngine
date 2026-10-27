import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  planGeneration,
  type BracketMatchDef,
} from "@/lib/bracket-engine";
import {
  canManageTournament,
  deleteRoundsOfTournament,
  emitBracketUpdated,
} from "@/lib/tournament-server";
import { ensureRiotTournament } from "@/lib/riot-integration";

const generateSchema = z.object({
  slotOrder: z.array(z.string().min(1).nullable()).optional(),
});

function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  return 1 << (32 - Math.clz32(n - 1));
}

/** Llave simple armada a mano: respeta el orden exacto del organizador. */
function buildManualSingleElimination(seedIds: (string | null)[]): BracketMatchDef[] {
  const totalSlots = nextPowerOf2(Math.max(2, seedIds.length));
  const rounds = Math.log2(totalSlots);
  const padded: (string | null)[] = [...seedIds];
  while (padded.length < totalSlots) padded.push(null);

  const order: { r: number; p: number }[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = totalSlots / Math.pow(2, r);
    for (let p = 0; p < count; p++) order.push({ r, p });
  }

  return order.map(({ r, p }) => {
    const isFirstRound = r === 1;
    const t1 = isFirstRound ? (padded[p * 2] ?? null) : null;
    const t2 = isFirstRound ? (padded[p * 2 + 1] ?? null) : null;
    const isLastRound = r === rounds;
    const winnerNextIdx = isLastRound
      ? -1
      : order.findIndex((s) => s.r === r + 1 && s.p === Math.floor(p / 2));
    return {
      roundNumber: r,
      bracketPosition: p,
      phase: "UPPER" as const,
      team1Id: t1,
      team2Id: t2,
      winnerNextMatchIdx: winnerNextIdx,
      winnerNextSlot: (p % 2 === 0 ? 1 : 2) as 1 | 2,
      loserNextMatchIdx: -1,
      loserNextSlot: 1 as const,
    };
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede generar la llave" }, { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      tournamentTeams: { include: { team: { select: { id: true, name: true } } } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  if (tournament.bracketType === "SWISS") {
    return NextResponse.json({ error: "Modalidad no disponible" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsedBody = generateSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Orden de slots no válido" }, { status: 400 });
  }
  const slotOrder = parsedBody.data.slotOrder;

  const isLeagueOfLegends = (tournament.game ?? "").toUpperCase() === "LEAGUE_OF_LEGENDS";

  const buildDefs = (
    type: "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN",
    people: { id: string; name: string }[],
  ): { defs: BracketMatchDef[] } => {
    switch (type) {
      case "DOUBLE_ELIMINATION":
        try {
          return { defs: generateDoubleElimination(people) };
        } catch {
          throw new Error("Doble eliminación no disponible para más de 8 participantes");
        }
      case "ROUND_ROBIN":
        return { defs: generateRoundRobin(people) };
      default:
        return { defs: generateSingleElimination(people) };
    }
  };

  let contestants: { id: string; name: string }[] = [];
  let matchDefs: BracketMatchDef[];

  try {
    if (tournament.isTeamBased) {
      // La llave se arma con los equipos confirmados (TournamentTeam).
      contestants = tournament.tournamentTeams.map((tt) => ({
        id: tt.team.id,
        name: tt.team.name,
      }));
      if (contestants.length < 2) {
        return NextResponse.json(
          { error: "Se necesitan al menos 2 equipos confirmados para generar la llave" },
          { status: 400 }
        );
      }
      matchDefs = buildDefs(tournament.bracketType as "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN", contestants).defs;
    } else if (slotOrder) {
      // Solo las inscripciones aprobadas entran a la llave.
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id, status: "CONFIRMED" },
        include: { user: { select: { id: true, username: true } } },
      });
      const confirmedById = new Map(registrations.map((r) => [r.user.id, r.user.username]));

      const activeIds = slotOrder.filter((sid): sid is string => sid !== null);
      if (new Set(activeIds).size !== activeIds.length) {
        return NextResponse.json({ error: "Hay participantes repetidos en los slots" }, { status: 400 });
      }
      for (const sid of activeIds) {
        if (!confirmedById.has(sid)) {
          return NextResponse.json(
            { error: "Todos los slots deben ocuparse con inscripciones aprobadas" },
            { status: 400 }
          );
        }
      }
      contestants = activeIds.map((sid) => ({ id: sid, name: confirmedById.get(sid) || "Jugador" }));
      matchDefs = buildManualSingleElimination(slotOrder);
    } else {
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id, status: "CONFIRMED" },
        include: { user: { select: { id: true, username: true } } },
      });
      contestants = registrations.map((r) => ({ id: r.user.id, name: r.user.username }));
      if (contestants.length < 2) {
        return NextResponse.json(
          { error: "Se necesitan al menos 2 jugadores aprobados para generar la llave" },
          { status: 400 }
        );
      }
      matchDefs = buildDefs(tournament.bracketType as "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN", contestants).defs;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Modalidad no disponible" },
      { status: 400 }
    );
  }

  const plan = planGeneration(matchDefs);
  if (plan.create.length === 0) {
    return NextResponse.json({ error: "No se pudo armar la llave con los participantes dados" }, { status: 400 });
  }

  const isTeamBased = tournament.isTeamBased;
  const roundIds = await prisma.$transaction(async (tx) => {
    await deleteRoundsOfTournament(id, tx);

    // Agrupa defs persistibles por ronda, en orden.
    const groups = new Map<number, { index: number; def: BracketMatchDef }[]>();
    for (const item of plan.create) {
      const list = groups.get(item.def.roundNumber) || [];
      list.push(item);
      groups.set(item.def.roundNumber, list);
    }

    const byeByIndex = new Map(plan.byes.map((b) => [b.index, b.winnerId]));
    const matchIdByDefIndex = new Map<number, string>();
    const createdRoundIds: string[] = [];

    for (const roundNumber of [...groups.keys()].sort((a, b) => a - b)) {
      const round = await tx.tournamentRound.create({
        data: { tournamentId: id, roundNumber },
      });
      createdRoundIds.push(round.id);

      for (const { index, def } of groups.get(roundNumber)!) {
        const teams = plan.finalTeams.get(index)!;
        const byeWinner = byeByIndex.get(index);
        const winnerInSlot1 = byeWinner && teams.team1Id === byeWinner;
        const match = await tx.match.create({
          data: {
            roundId: round.id,
            bracketPosition: def.bracketPosition,
            phase: def.phase,
            team1Id: teams.team1Id,
            team2Id: teams.team2Id,
            status: byeWinner ? "COMPLETED" : "PENDING",
            ...(byeWinner
              ? {
                  winnerId: isTeamBased ? byeWinner : null,
                  score1: winnerInSlot1 ? 1 : 0,
                  score2: winnerInSlot1 ? 0 : 1,
                  endedAt: new Date(),
                }
              : {}),
          },
        });
        matchIdByDefIndex.set(index, match.id);
      }
    }

    // Conexiones de avance: solo hacia partidos que realmente existen.
    for (const { index, def } of plan.create) {
      const updates: Record<string, string | number> = {};
      const winnerTarget = def.winnerNextMatchIdx >= 0 ? matchIdByDefIndex.get(def.winnerNextMatchIdx) : undefined;
      if (winnerTarget) {
        updates.winnerNextMatchId = winnerTarget;
        updates.winnerNextSlot = def.winnerNextSlot;
      }
      const loserTarget = def.loserNextMatchIdx >= 0 ? matchIdByDefIndex.get(def.loserNextMatchIdx) : undefined;
      if (loserTarget) {
        updates.loserNextMatchId = loserTarget;
        updates.loserNextSlot = def.loserNextSlot;
      }
      if (Object.keys(updates).length > 0) {
        await tx.match.update({ where: { id: matchIdByDefIndex.get(index)! }, data: updates });
      }
    }

    await tx.tournament.update({ where: { id }, data: { status: "IN_PROGRESS" } });

    return createdRoundIds;
  });

  if (isLeagueOfLegends) {
    try {
      await ensureRiotTournament(id);
    } catch (err) {
      console.error(
        `[RoundsRoute] Auto-registro con Riot falló para el torneo ${id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  emitBracketUpdated(id);

  return NextResponse.json(
    {
      rounds: roundIds,
      roundCount: roundIds.length,
      byes: plan.byes.length,
      status: "IN_PROGRESS",
    },
    { status: 201 }
  );
}
