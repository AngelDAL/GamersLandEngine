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

// ─── Resultado con motivo (para errores honestos en las rutas) ───────────────

/**
 * Por qué falló una consulta a Riot. Permite que `/api/profile/riot-link`
 * responda 404 "cuenta no encontrada", 429 "demasiadas consultas" o 503
 * "sin configurar" en lugar de un 500 genérico: `null` en el fetch no
 * distingue rate limit de red, y esa distinción es exactamente lo que pide
 * el brief W4.
 */
export type RiotLookupFailure =
  | "no-key"
  | "network"
  | "not-found"
  | "rate-limited"
  | "upstream";

export type RiotLookup<T> =
  | { ok: true; value: T }
  | { ok: false; failure: RiotLookupFailure; status?: number };

function isFailure(
  res: Response | null,
): { ok: false; failure: RiotLookupFailure; status?: number } | null {
  if (!res) return { ok: false, failure: "network" };
  if (res.status === 404) return { ok: false, failure: "not-found", status: 404 };
  if (res.status === 429) {
    console.warn("[riot-account] HTTP 429 — límite de peticiones de Riot alcanzado");
    return { ok: false, failure: "rate-limited", status: 429 };
  }
  if (!res.ok) {
    console.warn(`[riot-account] consulta rechazada: HTTP ${res.status} ${res.statusText}`);
    return { ok: false, failure: "upstream", status: res.status };
  }
  return null;
}

/**
 * Look up a Riot account by Riot ID (gameName#tagLine) → PUUID, keeping the
 * failure reason (404 / 429 / red / sin clave) for the caller.
 */
export async function lookupAccountByRiotId(
  gameName: string,
  tagLine: string,
  region: RiotRegion,
): Promise<RiotLookup<RiotAccount>> {
  if (!RIOT_API_KEY_HELPER.get()) return { ok: false, failure: "no-key" };
  const cluster = getRegionalCluster(region);
  const encodedName = encodeURIComponent(gameName);
  const encodedTag = encodeURIComponent(tagLine);
  const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;
  const res = await riotFetch(url);
  const failure = isFailure(res);
  if (failure) return failure;
  const data = (await res!.json()) as { puuid: string; gameName: string; tagLine: string };
  return { ok: true, value: { puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine } };
}

/**
 * Look up a Riot account by Riot ID (gameName#tagLine) → PUUID.
 * Returns null on 404, on rate limit, on network error, or on missing key.
 * Prefiere `lookupAccountByRiotId` cuando el motivo del fallo importa.
 */
export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
  region: RiotRegion,
): Promise<RiotAccount | null> {
  const result = await lookupAccountByRiotId(gameName, tagLine, region);
  return result.ok ? result.value : null;
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

/**
 * Same as `getSummonerByPuuid` but preserving why it failed (404 sin partidas
 * en la región, 429, red, sin clave) para que la ruta de vinculación pueda
 * responder en español sin adivinar.
 */
export async function lookupSummonerByPuuid(
  puuid: string,
  region: RiotRegion,
): Promise<RiotLookup<SummonerByPuuid>> {
  if (!RIOT_API_KEY_HELPER.get()) return { ok: false, failure: "no-key" };
  const url = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  const res = await riotFetch(url);
  const failure = isFailure(res);
  if (failure) return failure;
  // Some Riot dev keys omit `id` and `accountId`. Mark them optional; downstream
  // code falls back to PUUID-based endpoints.
  const data = (await res!.json()) as {
    id?: string; accountId?: string; puuid: string;
    summonerLevel: number; profileIconId: number;
  };
  if (!data.id) {
    console.warn(`[riot-account] getSummonerByPuuid: response missing 'id' (puuid=${data.puuid.slice(0, 8)}…) — ranked will use League-v4 by-puuid fallback`);
  }
  return {
    ok: true,
    value: {
      id: data.id,
      accountId: data.accountId,
      puuid: data.puuid,
      summonerLevel: data.summonerLevel,
      profileIconId: data.profileIconId,
    },
  };
}

export async function getSummonerByPuuid(
  puuid: string,
  region: RiotRegion,
): Promise<SummonerByPuuid | null> {
  const result = await lookupSummonerByPuuid(puuid, region);
  return result.ok ? result.value : null;
}

export const riotAccountService = {
  getAccountByRiotId,
  getAccountByPuuid,
  getSummonerByPuuid,
  lookupAccountByRiotId,
  lookupSummonerByPuuid,
};
