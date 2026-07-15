/**
 * Riot Data Dragon helpers.
 *
 * Data Dragon is Riot's static CDN of game data (champions, items, runes,
 * splash art). It needs no API key, but its `version` is rate-limited-ish
 * and the data is version-pinned (each patch).
 *
 * @see https://developer.riotgames.com/docs/lol#data-dragon
 */
import { cacheGet, cacheSet, CacheTTL } from "./riot-profile-cache";

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

/** Cached latest version string. */
let _versionCache: { value: string; fetchedAt: number } | null = null;
const VERSION_STALE_MS = 1000 * 60 * 60 * 6; // 6h

export async function getLatestVersion(): Promise<string> {
  const now = Date.now();
  if (_versionCache && now - _versionCache.fetchedAt < VERSION_STALE_MS) {
    return _versionCache.value;
  }
  // Also try the persistent DB cache (24h TTL)
  const cached = await cacheGet<string>("ddragon:version");
  if (cached) {
    _versionCache = { value: cached, fetchedAt: now };
    return cached;
  }
  try {
    const res = await fetch(`${DDRAGON_BASE}/api/versions.json`);
    if (!res.ok) throw new Error(`versions.json status ${res.status}`);
    const versions = (await res.json()) as string[];
    const latest = versions[0];
    if (!latest) throw new Error("versions.json empty");
    _versionCache = { value: latest, fetchedAt: now };
    await cacheSet("ddragon:version", latest, CacheTTL.DDRAGON);
    return latest;
  } catch (err) {
    console.warn(`[riot-datadragon] failed to fetch latest version:`, err);
    // Last-ditch fallback so callers don't crash:
    if (_versionCache) return _versionCache.value;
    return "16.14.1";
  }
}

/** Public export for callers that want the version (e.g. for splash art URLs). */
export async function getLatestDDragonVersion(): Promise<string> {
  return getLatestVersion();
}

// ─── Champion JSON ───────────────────────────────────────────────────────────

export interface DDragonSkin {
  id: string;
  num: number;
  name: string;
  chromas: boolean;
}

export interface DDragonChampion {
  id: string;        // e.g. "Ahri"
  key: string;       // numeric string, e.g. "103"
  name: string;      // "Ahri"
  title: string;     // "the Nine-Tailed Fox"
  image: { full: string; sprite: string; group: string };
  skins: DDragonSkin[];
  tags: string[];
  [key: string]: unknown;
}

export interface DDragonChampionJson {
  type: string;
  version: string;
  data: Record<string, DDragonChampion>;
}

let _championJsonCache: { version: string; data: DDragonChampionJson; fetchedAt: number } | null = null;
const CHAMPION_STALE_MS = 1000 * 60 * 60 * 6; // 6h

export async function getChampionJson(): Promise<DDragonChampionJson> {
  const now = Date.now();
  if (_championJsonCache && now - _championJsonCache.fetchedAt < CHAMPION_STALE_MS) {
    return _championJsonCache.data;
  }
  // Try DB cache
  const cached = await cacheGet<DDragonChampionJson>("ddragon:champions");
  if (cached) {
    _championJsonCache = { version: cached.version, data: cached, fetchedAt: now };
    return cached;
  }
  const version = await getLatestVersion();
  const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`;
  const res = await fetch(url);
  if (!res.ok) {
    if (_championJsonCache) return _championJsonCache.data;
    throw new Error(`champion.json status ${res.status}`);
  }
  const data = (await res.json()) as DDragonChampionJson;
  _championJsonCache = { version, data, fetchedAt: now };
  await cacheSet("ddragon:champions", data, CacheTTL.DDRAGON);
  return data;
}

/** Get a champion by its numeric Riot key (e.g. 103 for Ahri). */
export async function getChampionById(championId: number): Promise<DDragonChampion | null> {
  const json = await getChampionJson();
  const found = Object.values(json.data).find((c) => c.key === String(championId));
  if (!found) return null;
  // DDragon's bulk champion.json omits `skins` to keep the payload small.
  // Splash art code needs it, so fetch the per-champion file lazily.
  if (!Array.isArray(found.skins) || found.skins.length === 0) {
    return await fetchChampionDetail(found.id);
  }
  return found;
}

/**
 * Fetch the per-champion detail JSON from DDragon (includes skins + spells).
 * Cached in DB (24h) — only champions we display splash art for end up here.
 */
const _detailInflight = new Map<string, Promise<DDragonChampion | null>>();
async function fetchChampionDetail(ddragonId: string): Promise<DDragonChampion | null> {
  const cached = _detailInflight.get(ddragonId);
  if (cached) return cached;
  const cacheKey = `ddragon:champion:${ddragonId}`;
  const p = (async () => {
    const fromDb = await cacheGet<DDragonChampion>(cacheKey);
    if (fromDb && Array.isArray(fromDb.skins) && fromDb.skins.length > 0) {
      return fromDb;
    }
    const version = await getLatestVersion();
    const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion/${ddragonId}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[riot-datadragon] fetchChampionDetail ${ddragonId} failed: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data: Record<string, DDragonChampion> };
    const champ = json.data[ddragonId];
    if (champ) {
      await cacheSet(cacheKey, champ, CacheTTL.DDRAGON);
    }
    return champ;
  })().finally(() => _detailInflight.delete(ddragonId));
  _detailInflight.set(ddragonId, p);
  return p;
}

/** Get a champion by its DDragon id (e.g. "Ahri"). */
export async function getChampionByDDragonId(ddragonId: string): Promise<DDragonChampion | null> {
  const json = await getChampionJson();
  return json.data[ddragonId] ?? null;
}

// ─── URLs ────────────────────────────────────────────────────────────────────

/** URL to the champion's square icon (used in the profile UI). */
export async function getChampionIconUrl(championId: number): Promise<string | null> {
  const version = await getLatestVersion();
  const champ = await getChampionById(championId);
  if (!champ) return null;
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${champ.image.full}`;
}

/**
 * URL to a summoner's profile icon (the small circular avatar you see next
 * to a player's name in-client). `iconId` is the `profileIconId` from
 * Summoner-v4. Returns null when the ID is missing/zero so callers can fall
 * back to a letter avatar.
 */
export async function getProfileIconUrl(iconId: number): Promise<string | null> {
  if (!iconId || iconId <= 0) return null;
  const version = await getLatestVersion();
  return `${DDRAGON_BASE}/cdn/${version}/img/profileicon/${iconId}.png`;
}

/**
 * URL to a champion's splash art.
 *  - skinNum 0 = the default skin ("Original")
 *  - otherwise use the champion's `skins[i].num` field
 */
export async function getChampionSplashUrl(
  championId: number,
  skinNum: number = 0,
): Promise<string | null> {
  const version = await getLatestVersion();
  const champ = await getChampionById(championId);
  if (!champ) return null;
  return `${DDRAGON_BASE}/cdn/${version}/img/splash/${champ.id}_${skinNum}.jpg`;
}

/** Re-export the getChampionJson as a more discoverable alias. */
export { getChampionJson as getDDragonChampionJson };
