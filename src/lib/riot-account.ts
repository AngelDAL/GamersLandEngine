/**
 * Riot Account-v1 service
 *
 * Resolves Riot IDs (gameName#tagLine) to PUUIDs and back. Account-v1 is
 * regional-cluster-based (americas / asia / europe), not platform-based.
 *
 * Endpoints used:
 *   GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
 *   GET /riot/account/v1/accounts/by-puuid/{puuid}
 *   GET /riot/account/v1/accounts/me                (requires user auth, not used here)
 *
 * @see https://developer.riotgames.com/apis#account-v1
 */
import { getRegionalCluster, RIOT_API_KEY_HELPER, type RiotRegion } from "./riot-service";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

/**
 * Normalise a user-provided Riot ID, splitting "Quieto Compadre#Compa" into
 * { gameName: "Quieto Compadre", tagLine: "Compa" }. Throws if the format is invalid.
 */
export function parseRiotId(riotId: string): { gameName: string; tagLine: string } {
  const trimmed = riotId.trim();
  const hashIdx = trimmed.lastIndexOf("#");
  if (hashIdx <= 0 || hashIdx === trimmed.length - 1) {
    throw new Error(
      "Formato de Riot ID inválido. Debe ser 'GameName#TAG' (ejemplo: Faker#KR1).",
    );
  }
  return {
    gameName: trimmed.slice(0, hashIdx).trim(),
    tagLine: trimmed.slice(hashIdx + 1).trim(),
  };
}

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

/**
 * Look up a Riot account by Riot ID (gameName#tagLine) → PUUID.
 * Returns null on 404, on rate limit, on network error, or on missing key.
 */
export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
  region: RiotRegion,
): Promise<RiotAccount | null> {
  const cluster = getRegionalCluster(region);
  const encodedName = encodeURIComponent(gameName);
  const encodedTag = encodeURIComponent(tagLine);
  const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;
  const res = await riotFetch(url);
  if (!res) return null;
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`[riot-account] getAccountByRiotId failed: ${res.status} ${res.statusText}`);
    return null;
  }
  const data = (await res.json()) as { puuid: string; gameName: string; tagLine: string };
  return { puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine };
}

/**
 * Reverse lookup: PUUID → Riot ID.
 */
export async function getAccountByPuuid(
  puuid: string,
  region: RiotRegion,
): Promise<RiotAccount | null> {
  const cluster = getRegionalCluster(region);
  const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { puuid: string; gameName: string; tagLine: string };
  return { puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine };
}

/**
 * Summoner-v4 by PUUID: returns summoner level and profile icon.
 * Platform-scoped (la1, na1, etc.), not regional.
 */
export interface SummonerByPuuid {
  id?: string;        // Riot encrypted summonerId (may be missing with dev keys / scoped permissions)
  accountId?: string; // Encrypted accountId (deprecated, may be missing)
  puuid: string;
  summonerLevel: number;
  profileIconId: number;
}

export async function getSummonerByPuuid(
  puuid: string,
  region: RiotRegion,
): Promise<SummonerByPuuid | null> {
  const apiKey = RIOT_API_KEY_HELPER.get();
  if (!apiKey) return null;
  const url = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  const res = await riotFetch(url);
  if (!res || !res.ok) {
    if (res?.status === 404) return null;
    console.warn(`[riot-account] getSummonerByPuuid failed: ${res?.status ?? "no-response"}`);
    return null;
  }
  // Some Riot dev keys omit `id` and `accountId`. Mark them optional; downstream
  // code falls back to PUUID-based endpoints.
  const data = (await res.json()) as {
    id?: string; accountId?: string; puuid: string;
    summonerLevel: number; profileIconId: number;
  };
  if (!data.id) {
    console.warn(`[riot-account] getSummonerByPuuid: response missing 'id' (puuid=${data.puuid.slice(0, 8)}…) — ranked will use League-v4 by-puuid fallback`);
  }
  return {
    id: data.id,
    accountId: data.accountId,
    puuid: data.puuid,
    summonerLevel: data.summonerLevel,
    profileIconId: data.profileIconId,
  };
}

export const riotAccountService = {
  getAccountByRiotId,
  getAccountByPuuid,
  getSummonerByPuuid,
};
