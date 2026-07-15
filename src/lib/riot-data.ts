/**
 * Riot Data services: League-v4 (ranked), Champion Mastery-v4 (top champs),
 * Match-v5 (recent match list + match detail).
 *
 * All endpoints are platform-scoped (la1, na1, etc.) EXCEPT match-v5 which
 * uses the regional cluster (americas/asia/europe).
 *
 * @see https://developer.riotgames.com/apis#league-v4
 * @see https://developer.riotgames.com/apis#champion-mastery-v4
 * @see https://developer.riotgames.com/apis#match-v5
 */
import { getRegionalCluster, RIOT_API_KEY_HELPER, type RiotRegion } from "./riot-service";

const DEFAULT_TIMEOUT_MS = 8_000;

async function riotFetch(url: string): Promise<Response | null> {
  const apiKey = RIOT_API_KEY_HELPER.get();
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": apiKey, Accept: "application/json" },
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── League-v4 (Ranked) ──────────────────────────────────────────────────────

export interface RankedEntry {
  leagueId: string;
  summonerId: string;
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | "RANKED_FLEX_TT" | string;
  tier: "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER" | string;
  rank: "I" | "II" | "III" | "IV" | string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
}

export async function getRankedEntries(
  summonerId: string,
  region: RiotRegion,
): Promise<RankedEntry[]> {
  const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return [];
    console.warn(`[riot-data] getRankedEntries failed: ${res?.status ?? "no-response"}`);
    return [];
  }
  return (await res.json()) as RankedEntry[];
}

/**
 * League-v4 by PUUID fallback. Used when Summoner-v4 omits the `id` field
 * (some dev keys / scoped permissions). Returns the same shape, but with
 * `summonerId` populated from the PUUID.
 */
export async function getRankedEntriesByPuuid(
  puuid: string,
  region: RiotRegion,
): Promise<RankedEntry[]> {
  const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return [];
    console.warn(`[riot-data] getRankedEntriesByPuuid failed: ${res?.status ?? "no-response"}`);
    return [];
  }
  const arr = (await res.json()) as Array<Omit<RankedEntry, "summonerId"> & { puuid?: string }>;
  // Normalize: League-v4 by-puuid returns objects with `puuid` instead of `summonerId`.
  return arr.map((e) => ({
    ...e,
    summonerId: e.puuid ?? puuid,
  }));
}

// ─── Champion Mastery-v4 (Top champions) ──────────────────────────────────────

export interface MasteryEntry {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championPointsSinceLastLevel: number;
  championPointsUntilNextLevel: number;
  chestGranted: boolean;
  tokensEarned: number;
}

export async function getTopMastery(
  puuid: string,
  region: RiotRegion,
  count: number = 5,
): Promise<MasteryEntry[]> {
  const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return [];
    console.warn(`[riot-data] getTopMastery failed: ${res?.status ?? "no-response"}`);
    return [];
  }
  return (await res.json()) as MasteryEntry[];
}

// ─── Match-v5 (Recent matches) ───────────────────────────────────────────────

/**
 * List the last N match IDs for a PUUID (most recent first). No queue filter
 * so we get normals, ARAM, ranked, URF, etc. — the profile UI shows the queue
 * per match.
 */
export async function getRecentMatchIds(
  puuid: string,
  region: RiotRegion,
  count: number = 20,
): Promise<string[]> {
  const cluster = getRegionalCluster(region);
  const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return [];
    console.warn(`[riot-data] getRecentMatchIds failed: ${res?.status ?? "no-response"}`);
    return [];
  }
  return (await res.json()) as string[];
}

export interface MatchParticipant {
  puuid: string;
  championId: number;
  teamPosition: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "INVALID" | string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  // Extras present in the API response (not always typed):
  challenges?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MatchDetail {
  matchId: string;
  queueId: number;
  gameMode: string;
  gameDuration: number; // seconds
  gameStartTimestamp: number;
  /** Convenience: derived from participants. */
  championId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  itemIds: number[];
  summoner1DPerk: number;
  summoner2DPerk: number;
  participants: MatchParticipant[];
}

export async function getMatch(
  matchId: string,
  region: RiotRegion,
  puuidForPerspective?: string,
): Promise<MatchDetail | null> {
  const cluster = getRegionalCluster(region);
  const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return null;
    console.warn(`[riot-data] getMatch failed: ${res?.status ?? "no-response"} (matchId=${matchId})`);
    return null;
  }
  const data = (await res.json()) as {
    metadata: { matchId: string; participants: string[] };
    info: {
      queueId: number;
      gameMode: string;
      gameDuration: number;
      gameStartTimestamp: number;
      participants: Array<Record<string, unknown>>;
    };
  };

  const participants = data.info.participants as unknown as MatchParticipant[];
  // Pick the participant matching the requesting PUUID, fallback to first.
  const me =
    (puuidForPerspective &&
      participants.find((p) => p.puuid === puuidForPerspective)) ||
    participants[0];

  if (!me) return null;

  const cs = (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0);

  return {
    matchId: data.metadata.matchId,
    queueId: data.info.queueId,
    gameMode: data.info.gameMode,
    gameDuration: data.info.gameDuration,
    gameStartTimestamp: data.info.gameStartTimestamp,
    championId: me.championId,
    win: !!me.win,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    cs,
    itemIds: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6],
    summoner1DPerk: me.summoner1Id,
    summoner2DPerk: me.summoner2Id,
    participants,
  };
}

export const riotDataService = {
  getRankedEntries,
  getRankedEntriesByPuuid,
  getTopMastery,
  getRecentMatchIds,
  getMatch,
};
