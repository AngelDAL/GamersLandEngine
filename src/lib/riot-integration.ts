/**
 * Riot Tournament integration helpers.
 *
 * Auto-registers the provider and tournament with Riot Games the first time
 * it's needed. Once registered, the IDs are persisted on the Tournament row
 * so subsequent calls are no-ops.
 *
 * El provider se cachea por torneo (nunca entre torneos) y las creaciones
 * concurrentes del mismo torneo se deduplican, para no gastar peticiones de
 * la ventana de 100 req / 2 min.
 *
 * En modo live, si el torneo no está dado de alta externamente, se lanza
 * `RiotLiveNotConfiguredError` (mensaje "Modo live no configurado") en
 * lugar de dejar que Riot devuelva un error crudo.
 */
import { prisma } from "@/lib/prisma";
import {
  riotService,
  RIOT_CALLBACK_URL,
  RIOT_LIVE_NOT_CONFIGURED,
  getRiotMode,
  type RiotCodeConfig,
} from "@/lib/riot-service";

const DEFAULT_REGION = "LAN";

/**
 * El registro externo (provider/torneo en Riot con la clave de producción)
 * lo hace el dueño; aquí no se finge que exista.
 */
export class RiotLiveNotConfiguredError extends Error {
  constructor() {
    super(RIOT_LIVE_NOT_CONFIGURED);
    this.name = "RiotLiveNotConfiguredError";
  }
}

/** Creaciones de provider en curso, deduplicadas por torneo. */
const providerInFlight = new Map<string, Promise<number>>();

/**
 * Ensure the tournament has a Riot provider ID.
 * If not, register one and persist the result on the Tournament row.
 *
 * Idempotent: safe to call multiple times.
 */
export async function ensureRiotProvider(tournamentId: string): Promise<number> {
  const pending = providerInFlight.get(tournamentId);
  if (pending) return pending;

  const creation = (async () => {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { riotProviderId: true },
    });
    if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

    if (tournament.riotProviderId) return tournament.riotProviderId;

    // Guard de modo live: sin registro externo no se genera nada.
    if (getRiotMode() === "production") throw new RiotLiveNotConfiguredError();

    const providerId = await riotService.createProvider(DEFAULT_REGION, RIOT_CALLBACK_URL);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { riotProviderId: providerId, riotMode: getRiotMode() },
    });
    return providerId;
  })().finally(() => providerInFlight.delete(tournamentId));

  providerInFlight.set(tournamentId, creation);
  return creation;
}

/**
 * Ensure the tournament is registered with Riot.
 * If not, register it under the given provider and persist the result.
 *
 * Idempotent: safe to call multiple times.
 */
export async function ensureRiotTournament(tournamentId: string): Promise<number> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { riotTournamentId: true, riotProviderId: true, name: true },
  });
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

  if (tournament.riotTournamentId) return tournament.riotTournamentId;

  const providerId = await ensureRiotProvider(tournamentId);
  const riotTournamentId = await riotService.createTournament(providerId, tournament.name);

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { riotTournamentId },
  });
  return riotTournamentId;
}

/**
 * Generate a single Riot tournament code for one match.
 *
 * Each match gets its own code. The code is stored on the Match row so the
 * Riot webhook at `/api/riot/callback` can resolve the code back to the match.
 */
export async function generateMatchCode(
  matchId: string,
  config?: Partial<RiotCodeConfig>,
): Promise<string> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      round: {
        include: {
          tournament: {
            select: {
              id: true,
              isTeamBased: true,
              maxTeams: true,
            },
          },
        },
      },
    },
  });
  if (!match) throw new Error(`Match ${matchId} not found`);

  if (match.riotCode) return match.riotCode;

  const tournamentId = match.round.tournament.id;
  const riotTournamentId = await ensureRiotTournament(tournamentId);

  const codeConfig: RiotCodeConfig = {
    mapType: config?.mapType ?? "SUMMONERS_RIFT",
    pickType: config?.pickType ?? "TOURNAMENT_DRAFT",
    spectatorType: config?.spectatorType ?? "LOBBY_ONLY",
    teamSize: config?.teamSize ?? (match.round.tournament.isTeamBased ? 5 : 1),
  };

  const [code] = await riotService.generateCodes(riotTournamentId, 1, codeConfig);
  if (!code) throw new Error("Riot returned no codes");

  await prisma.match.update({
    where: { id: matchId },
    data: { riotCode: code },
  });
  return code;
}
