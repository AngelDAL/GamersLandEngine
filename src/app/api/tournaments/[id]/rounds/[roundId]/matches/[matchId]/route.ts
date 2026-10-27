import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament, emitBracketUpdated } from "@/lib/tournament-server";

async function notifyParticipants(matchId: string, tournamentId: string, type: string, title: string, message: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: { select: { tournament: { select: { name: true, isTeamBased: true } } } },
    },
  });
  if (!match) return;

  const participantIds = new Set<string>();
  const redirectUrl = `/tournaments/${tournamentId}/bracket`;

  if (match.round.tournament.isTeamBased) {
    for (const tid of [match.team1Id, match.team2Id]) {
      if (!tid) continue;
      const members = await prisma.teamMember.findMany({
        where: { teamId: tid, status: "ACTIVE" },
        select: { userId: true },
      });
      members.forEach((m) => participantIds.add(m.userId));
    }
  } else {
    if (match.team1Id) participantIds.add(match.team1Id);
    if (match.team2Id) participantIds.add(match.team2Id);
  }

  for (const userId of participantIds) {
    await prisma.notification.create({
      data: { userId, type, title, message, matchId, redirectUrl },
    });
  }
}

const scheduleSchema = z.object({
  scheduledAt: z
    .string({ message: "Fecha no válida" })
    .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
    .nullable(),
});

const updateSchema = z.object({
  score1: z.number().int().min(0, "Marcador no válido").nullable().optional(),
  score2: z.number().int().min(0, "Marcador no válido").nullable().optional(),
  winnerId: z.string().min(1).nullable().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

function deriveWinner(
  team1Id: string | null,
  team2Id: string | null,
  score1: number | null,
  score2: number | null,
): string | null {
  if (!team1Id || !team2Id) return null;
  if (score1 === null || score2 === null || score1 === score2) return null;
  return score1 > score2 ? team1Id : team2Id;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { matchId, id: tournamentId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede marcar resultados" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: {
        select: {
          tournamentId: true,
          roundNumber: true,
          tournament: { select: { name: true, location: true, isTeamBased: true, status: true } },
        },
      },
    },
  });
  if (!match || match.round.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  // ── Programación ──
  if ("scheduledAt" in raw) {
    const parsedSchedule = scheduleSchema.safeParse({ scheduledAt: raw.scheduledAt ?? null });
    if (!parsedSchedule.success) {
      return NextResponse.json({ error: parsedSchedule.error.issues[0]?.message || "Fecha no válida" }, { status: 400 });
    }
    const scheduledDate = parsedSchedule.data.scheduledAt ? new Date(parsedSchedule.data.scheduledAt) : null;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { scheduledAt: scheduledDate },
    });

    if (scheduledDate) {
      const tournament = match.round.tournament;
      await notifyParticipants(
        matchId, tournamentId, "match_scheduled",
        `Partida programada - ${tournament.name}`,
        `Ronda ${match.round.roundNumber} programada para el ${scheduledDate.toLocaleDateString("es-MX")} a las ${scheduledDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}${tournament.location ? ` en ${tournament.location}` : ""}`
      );
    }

    emitBracketUpdated(tournamentId);
    return NextResponse.json(updated);
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue ? `${issue.message}` : "Datos del partido no válidos" }, { status: 400 });
  }
  const data = parsed.data;

  const isTeamBased = match.round.tournament.isTeamBased;
  const wasCompleted = match.status === "COMPLETED";
  // `winnerId: null` sobre un partido ya jugado es una revocación: si no se
  // indica estado, el partido vuelve a pendiente (nunca queda a medias).
  const newStatus =
    data.status ?? (wasCompleted && data.winnerId === null ? "PENDING" : match.status);

  // ── Ganador anterior (para poder deshacer) ──
  const derivedPrev = deriveWinner(match.team1Id, match.team2Id, match.score1, match.score2);
  const prevWinner = match.winnerId ?? (!isTeamBased ? derivedPrev : null);
  const prevLoser = prevWinner
    ? prevWinner === match.team1Id
      ? match.team2Id
      : match.team1Id
    : null;

  // ── Ganador nuevo ──
  let resolvedWinner: string | null;
  if (data.winnerId === null) {
    resolvedWinner = null;
  } else if (data.winnerId !== undefined) {
    if (data.winnerId !== match.team1Id && data.winnerId !== match.team2Id) {
      return NextResponse.json({ error: "El ganador debe ser uno de los participantes del partido" }, { status: 400 });
    }
    resolvedWinner = data.winnerId;
  } else {
    resolvedWinner = deriveWinner(
      match.team1Id,
      match.team2Id,
      data.score1 !== undefined ? data.score1 : match.score1,
      data.score2 !== undefined ? data.score2 : match.score2,
    );
  }

  const effectiveScore1 = data.score1 !== undefined ? data.score1 : match.score1;
  const effectiveScore2 = data.score2 !== undefined ? data.score2 : match.score2;

  if (
    newStatus === "COMPLETED" &&
    effectiveScore1 !== null &&
    effectiveScore2 !== null &&
    effectiveScore1 === effectiveScore2
  ) {
    return NextResponse.json({ error: "El marcador no puede quedar empatado" }, { status: 400 });
  }
  if (newStatus === "COMPLETED" && !resolvedWinner) {
    return NextResponse.json({ error: "Define el ganador del partido" }, { status: 400 });
  }
  if (
    newStatus === "COMPLETED" &&
    resolvedWinner &&
    effectiveScore1 !== null &&
    effectiveScore2 !== null &&
    ((resolvedWinner === match.team1Id && effectiveScore1 <= effectiveScore2) ||
      (resolvedWinner === match.team2Id && effectiveScore2 <= effectiveScore1))
  ) {
    return NextResponse.json({ error: "El marcador no coincide con el ganador indicado" }, { status: 400 });
  }

  const undoing = wasCompleted && (newStatus !== "COMPLETED" || (prevWinner !== null && resolvedWinner !== prevWinner));
  const completing = newStatus === "COMPLETED" && (!wasCompleted || resolvedWinner !== prevWinner);

  // El avance ya jugado no se puede deshacer a ciegas.
  if (undoing) {
    const nextChecks = [
      ...(match.winnerNextMatchId && prevWinner
        ? [{ id: match.winnerNextMatchId, participant: prevWinner }]
        : []),
      ...(match.loserNextMatchId && prevLoser ? [{ id: match.loserNextMatchId, participant: prevLoser }] : []),
    ];
    for (const check of nextChecks) {
      const next = await prisma.match.findUnique({ where: { id: check.id } });
      if (
        next &&
        next.status === "COMPLETED" &&
        (next.team1Id === check.participant || next.team2Id === check.participant)
      ) {
        return NextResponse.json(
          { error: "No se puede revocar: el avance ya se jugó en rondas posteriores" },
          { status: 409 }
        );
      }
    }
  }

  // ── Todo en una transacción: marcador, resultados, avance y cierre ──
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        // Al deshacer un resultado y volver a pendiente el marcador no debe
        // quedar visible (salvo que el cliente envíe uno nuevo).
        ...(data.score1 !== undefined
          ? { score1: data.score1 }
          : undoing && newStatus !== "COMPLETED"
            ? { score1: null }
            : {}),
        ...(data.score2 !== undefined
          ? { score2: data.score2 }
          : undoing && newStatus !== "COMPLETED"
            ? { score2: null }
            : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        status: newStatus,
        ...(isTeamBased
          ? {
              winnerId: completing ? resolvedWinner : undoing ? null : (resolvedWinner ?? match.winnerId),
            }
          : {}),
        startedAt: newStatus === "PENDING" ? null : (match.startedAt ?? new Date()),
        endedAt: newStatus === "COMPLETED" ? (match.endedAt ?? new Date()) : null,
      },
      include: { winner: { select: { id: true, name: true } } },
    });

    let tournamentStatus = match.round.tournament.status;

    if (undoing) {
      // Deshacer avance: al ganador y al perdedor de este partido.
      if (match.winnerNextMatchId && prevWinner) {
        const next = await tx.match.findUnique({ where: { id: match.winnerNextMatchId } });
        if (next && (next.team1Id === prevWinner || next.team2Id === prevWinner)) {
          await tx.match.update({
            where: { id: next.id },
            data: next.team1Id === prevWinner ? { team1Id: null } : { team2Id: null },
          });
        }
      }
      if (match.loserNextMatchId && prevLoser) {
        const next = await tx.match.findUnique({ where: { id: match.loserNextMatchId } });
        if (next && (next.team1Id === prevLoser || next.team2Id === prevLoser)) {
          await tx.match.update({
            where: { id: next.id },
            data: next.team1Id === prevLoser ? { team1Id: null } : { team2Id: null },
          });
        }
      }

      await tx.matchResult.deleteMany({ where: { matchId } });
      await tx.teamMatchResult.deleteMany({ where: { matchId } });

      // Si la gran final creó la ronda de desempate, se retira junto con ella.
      if (match.phase === "FINAL") {
        const resetRounds = await tx.tournamentRound.findMany({
          where: {
            tournamentId,
            roundNumber: { gt: match.round.roundNumber },
            matches: { some: { phase: "BRACKET_RESET" } },
          },
          select: { id: true },
        });
        for (const round of resetRounds) {
          const resetMatches = await tx.match.findMany({ where: { roundId: round.id }, select: { id: true } });
          const ids = resetMatches.map((m) => m.id);
          if (ids.length > 0) await tx.chatRoom.deleteMany({ where: { matchId: { in: ids } } });
          await tx.match.deleteMany({ where: { roundId: round.id } });
          await tx.tournamentRound.delete({ where: { id: round.id } });
        }
      }

      if (match.round.tournament.status === "COMPLETED") {
        await tx.tournament.update({ where: { id: tournamentId }, data: { status: "IN_PROGRESS" } });
        tournamentStatus = "IN_PROGRESS";
      }
    }

    if (completing && resolvedWinner) {
      const loserId = resolvedWinner === match.team1Id ? match.team2Id : match.team1Id;

      // Resultados frescos (idempotente aunque se repita el reporte).
      await tx.matchResult.deleteMany({ where: { matchId } });
      await tx.teamMatchResult.deleteMany({ where: { matchId } });

      if (isTeamBased) {
        for (const tid of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
          const won = tid === resolvedWinner;
          await tx.teamMatchResult.create({
            data: {
              matchId,
              teamId: tid,
              result: won ? "WON" : "LOST",
              score: tid === match.team1Id ? data.score1 ?? effectiveScore1 : data.score2 ?? effectiveScore2,
            },
          });
          const members = await tx.teamMember.findMany({
            where: { teamId: tid, status: "ACTIVE" },
            select: { userId: true },
          });
          for (const m of members) {
            await tx.matchResult.create({
              data: { matchId, userId: m.userId, teamId: tid, result: won ? "WON" : "LOST" },
            });
          }
        }
      } else {
        for (const uid of [match.team1Id, match.team2Id].filter(Boolean) as string[]) {
          const won = uid === resolvedWinner;
          await tx.matchResult.create({
            data: {
              matchId,
              userId: uid,
              result: won ? "WON" : "LOST",
              score: uid === match.team1Id ? data.score1 ?? effectiveScore1 : data.score2 ?? effectiveScore2,
            },
          });
        }
      }

      // ── Avance: exclusivamente del lado del servidor ──
      if (match.winnerNextMatchId && match.winnerNextSlot) {
        const slotField = match.winnerNextSlot === 1 ? "team1Id" : "team2Id";
        const next = await tx.match.findUnique({ where: { id: match.winnerNextMatchId } });
        if (!next || next[slotField] === null || next[slotField] === resolvedWinner) {
          await tx.match.update({
            where: { id: match.winnerNextMatchId },
            data: { [slotField]: resolvedWinner },
          });
        }
      }
      if (match.loserNextMatchId && match.loserNextSlot && loserId) {
        const slotField = match.loserNextSlot === 1 ? "team1Id" : "team2Id";
        const next = await tx.match.findUnique({ where: { id: match.loserNextMatchId } });
        if (!next || next[slotField] === null || next[slotField] === loserId) {
          await tx.match.update({
            where: { id: match.loserNextMatchId },
            data: { [slotField]: loserId },
          });
        }
      }

      // ── Gran final de doble eliminación ──
      // Si gana el campeón de la rama inferior, existe desempate (reset):
      // se crea esa ronda ahora, con ambos finalistas. Si gana el de la rama
      // superior, el torneo termina sin reset.
      if (match.phase === "FINAL" && resolvedWinner === match.team2Id) {
        const maxRound = await tx.tournamentRound.aggregate({
          where: { tournamentId },
          _max: { roundNumber: true },
        });
        const resetRound = await tx.tournamentRound.create({
          data: { tournamentId, roundNumber: (maxRound._max.roundNumber ?? match.round.roundNumber) + 1 },
        });
        await tx.match.create({
          data: {
            roundId: resetRound.id,
            bracketPosition: 0,
            phase: "BRACKET_RESET",
            team1Id: match.team1Id,
            team2Id: match.team2Id,
            status: "PENDING",
          },
        });
      }

      // ── Cierre automático del torneo ──
      const remaining = await tx.match.count({
        where: { round: { tournamentId }, status: { not: "COMPLETED" } },
      });
      if (remaining === 0) {
        await tx.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED" } });
        tournamentStatus = "COMPLETED";
      }
    }

    return { match: updated, tournamentStatus };
  });

  if (completing && resolvedWinner) {
    const winnerName = isTeamBased
      ? (result.match.winner?.name || "Equipo")
      : await prisma.user
          .findUnique({ where: { id: resolvedWinner }, select: { username: true } })
          .then((u) => u?.username || "Jugador");
    await notifyParticipants(
      matchId, tournamentId, "match_result",
      `Resultado - ${match.round.tournament.name}`,
      `Ronda ${match.round.roundNumber}: Ganador ${winnerName}`
    );
  }

  emitBracketUpdated(tournamentId);

  return NextResponse.json(result.match);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { matchId, id: tournamentId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede borrar combates" }, { status: 403 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, round: { select: { tournamentId: true } } },
  });
  if (!match || match.round.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.chatRoom.deleteMany({ where: { matchId } });
    await tx.match.delete({ where: { id: matchId } });
  });

  emitBracketUpdated(tournamentId);

  return NextResponse.json({ success: true });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; roundId: string; matchId: string }> }) {
  const { matchId, id: tournamentId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: { select: { tournamentId: true } },
      winner: { select: { id: true, name: true } },
      results: { include: { user: { select: { id: true, username: true } } } },
    },
  });
  if (!match || match.round.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }
  return NextResponse.json(match);
}
