/**
 * Riot Tournament integration helpers.
 *
 * Auto-registers the provider and tournament with Riot Games the first time
 * it's needed. Once registered, the IDs are persisted on the Tournament row
 * so subsequent calls are no-ops.
 *
 * The provider is created once per server instance and cached in a module-level
 * singleton so we don't hit Riot on every code generation.
 */
import { prisma } from "@/lib/prisma";
import { riotService, RIOT_CALLBACK_URL, type RiotCodeConfig } from "@/lib/riot-service";

const DEFAULT_REGION = "LAN";

/** Module-level cache so the provider is only registered once per process. */
let cachedProviderId: number | null = null;

/**
 * Ensure the tournament has a Riot provider ID.
 * If not, register one and persist the result on the Tournament row.
 *
 * Idempotent: safe to call multiple times.
 */
export async function ensureRiotProvider(tournamentId: string): Promise<number> {
  if (cachedProviderId !== null) return cachedProviderId;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { riotProviderId: true },
  });
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

  if (tournament.riotProviderId) {
    cachedProviderId = tournament.riotProviderId;
    return tournament.riotProviderId;
  }

  const providerId = await riotService.createProvider(DEFAULT_REGION, RIOT_CALLBACK_URL);
  cachedProviderId = providerId;
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { riotProviderId: providerId, riotMode: process.env.RIOT_MODE ?? "stub" },
  });
  return providerId;
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
