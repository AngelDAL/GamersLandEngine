// Helpers de servidor compartidos por las rutas de torneos
// (inscripciones, llave y resultados). Ninguno de ellos toca el esquema.
import { prisma } from "@/lib/prisma";
import { getIO } from "@/socket/server";
import type { Session } from "next-auth";

type SessionLike = Session | null | undefined;

/**
 * Quién puede gestionar un torneo: el ADMIN o quien lo creó / fue añadido
 * como organizador del MISMO torneo (no basta con ser ORGANIZER a secas).
 */
export async function canManageTournament(tournamentId: string, session: SessionLike): Promise<boolean> {
  if (!session?.user) return false;
  if (session.user.role === "ADMIN") return true;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      createdById: true,
      organizers: { where: { userId: session.user.id }, select: { userId: true } },
    },
  });
  if (!tournament) return false;
  return tournament.createdById === session.user.id || tournament.organizers.length > 0;
}

/**
 * Emite `bracket:updated` a la sala del torneo (`tournament:<id>`), nunca en
 * broadcast global a toda la app.
 *
 * Mientras el servidor de sockets no permita que un cliente se una a salas
 * `tournament:<id>` (solo sabe unirse a `team:` y `match:`), se envía además a
 * la sala personal `user:<id>` de quienes gestionan o participan en el
 * torneo: así la UI igual se actualiza en vivo sin abrir el evento a toda la
 * aplicación. Repórtalo si prefieres que solo se use la sala del torneo.
 */
export function emitBracketUpdated(tournamentId: string) {
  try {
    const io = getIO();
    io.to(`tournament:${tournamentId}`).emit("bracket:updated", { tournamentId });
    notifyTournamentMembers(io, tournamentId).catch((err) => {
      // Nunca dejar que la consulta en segundo plano rompa el proceso.
      console.error(`[torneos] No se notificó a los miembros (${tournamentId}):`, err);
    });
  } catch (err) {
    // El servidor de sockets puede no estar inicializado (p. ej. entornos de
    // prueba sin servidor custom): la llave sigue siendo correcta en BD.
    console.error(`[torneos] No se pudo emitir bracket:updated (${tournamentId}):`, err);
  }
}

async function notifyTournamentMembers(
  io: ReturnType<typeof getIO>,
  tournamentId: string
) {
  const [tournament, organizers, registrations] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { createdById: true },
    }),
    prisma.tournamentOrganizer.findMany({
      where: { tournamentId },
      select: { userId: true },
    }),
    prisma.tournamentRegistration.findMany({
      where: { tournamentId, status: "CONFIRMED" },
      select: { userId: true },
    }),
  ]);
  if (!tournament) return;
  const userIds = new Set<string>([
    tournament.createdById,
    ...organizers.map((o) => o.userId),
    ...registrations.map((r) => r.userId),
  ]);
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit("bracket:updated", { tournamentId });
  }
}

/** Crea el registro de equipo participante si no existe (idempotente). */
export async function ensureTournamentTeam(tournamentId: string, teamId: string) {
  const existing = await prisma.tournamentTeam.findUnique({
    where: { tournamentId_teamId: { tournamentId, teamId } },
  });
  if (existing) return existing;
  return prisma.tournamentTeam.create({ data: { tournamentId, teamId } });
}

/**
 * Si un equipo ya no tiene ninguna inscripción CONFIRMADA, lo retira del
 * torneo (libera cupo y evita que la llave lea un equipo fantasma).
 */
export async function syncTournamentTeam(tournamentId: string, teamId: string) {
  const confirmedLeft = await prisma.tournamentRegistration.count({
    where: { tournamentId, teamId, status: "CONFIRMED" },
  });
  if (confirmedLeft > 0) return;
  await prisma.tournamentTeam.deleteMany({ where: { tournamentId, teamId } });
}

/**
 * Unidad de conteo de cupo:
 *  - torneo individual → inscripciones PENDING + CONFIRMED;
 *  - torneo por equipos → equipos confirmados (TournamentTeam) + equipos con
 *    solicitud PENDING que aún no estén confirmados (cada equipo cuenta una
 *    vez, no cada miembro).
 */
export async function countEntrants(tournamentId: string, isTeamBased: boolean): Promise<number> {
  if (!isTeamBased) {
    return prisma.tournamentRegistration.count({
      where: { tournamentId, status: { in: ["PENDING", "CONFIRMED"] } },
    });
  }
  const [confirmedTeams, pendingRegs] = await Promise.all([
    prisma.tournamentTeam.findMany({ where: { tournamentId }, select: { teamId: true } }),
    prisma.tournamentRegistration.findMany({
      where: { tournamentId, status: "PENDING", teamId: { not: null } },
      select: { teamId: true },
    }),
  ]);
  const confirmedIds = new Set(confirmedTeams.map((t) => t.teamId));
  const pendingOnly = new Set(pendingRegs.map((r) => r.teamId!).filter((id) => !confirmedIds.has(id)));
  return confirmedIds.size + pendingOnly.size;
}

/** ¿Este usuario pertenece al equipo (capitán o miembro aceptado)? */
export async function userBelongsToTeam(teamId: string, userId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { captainId: true } });
  if (!team) return false;
  if (team.captainId === userId) return true;
  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId, status: { in: ["ACTIVE", "PENDING", "REQUEST"] } },
    select: { id: true },
  });
  return !!member;
}

/**
 * Borra de una vez chats, partidos y rondas de un torneo.
 * Todas las FK implicadas son Cascade, pero los ChatRoom guardan el id del
 * partido sin FK: hay que limpiarlos a mano para no dejar salas huérfanas.
 */
export type TxClient = Pick<typeof prisma, "chatRoom" | "match" | "tournamentRound">;

export async function deleteRoundsOfTournament(tournamentId: string, tx: TxClient = prisma) {
  const matches = await tx.match.findMany({
    where: { round: { tournamentId } },
    select: { id: true },
  });
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length > 0) {
    await tx.chatRoom.deleteMany({ where: { matchId: { in: matchIds } } });
  }
  await tx.match.deleteMany({ where: { round: { tournamentId } } });
  await tx.tournamentRound.deleteMany({ where: { tournamentId } });
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 2;
  return 1 << (32 - Math.clz32(n - 1));
}

/**
 * Crea la estructura vacía de una llave de eliminación simple (herramienta
 * manual del organizador) con las conexiones de avance ya cableadas, para que
 * el avance siga siendo exclusivo del servidor.
 */
export async function createEmptyBracket(tx: TxClient, tournamentId: string, numSlots: number) {
  const slots = nextPowerOfTwo(Math.max(2, numSlots));
  const numRounds = Math.log2(slots);
  const createdRoundIds: string[] = [];
  const matchIdByPos = new Map<string, string>();

  for (let r = 1; r <= numRounds; r++) {
    const round = await tx.tournamentRound.create({
      data: { tournamentId, roundNumber: r },
    });
    createdRoundIds.push(round.id);
    const matchCount = slots / Math.pow(2, r);
    for (let p = 0; p < matchCount; p++) {
      const match = await tx.match.create({
        data: { roundId: round.id, bracketPosition: p, status: "PENDING" },
      });
      matchIdByPos.set(`${r}:${p}`, match.id);
    }
  }

  for (let r = 1; r < numRounds; r++) {
    const matchCount = slots / Math.pow(2, r);
    for (let p = 0; p < matchCount; p++) {
      const from = matchIdByPos.get(`${r}:${p}`);
      const to = matchIdByPos.get(`${r + 1}:${Math.floor(p / 2)}`);
      if (from && to) {
        await tx.match.update({
          where: { id: from },
          data: { winnerNextMatchId: to, winnerNextSlot: p % 2 === 0 ? 1 : 2 },
        });
      }
    }
  }

  return { rounds: createdRoundIds, numSlots: slots, numRounds };
}
