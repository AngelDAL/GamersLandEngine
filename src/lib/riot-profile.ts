/**
 * Loader for a user's full LoL profile: ranked, top 5 mastery, and last 20
 * matches (read from PlayerMatchHistory — NOT from Riot's Match-v5 on every
 * call). This is what makes history permanent: rows are never deleted on
 * unlink, and the UI reads them straight from the database.
 *
 * The Riot API is only hit for:
 *  - Ranked entries (League-v4): changes every game
 *  - Top 5 mastery (Mastery-v4): changes slowly, cached 1h
 *  - Summoner level / icon (Summoner-v4): for the hero card
 *
 * Recent matches are top-up'd from Riot only on manual refresh, and persisted
 * into PlayerMatchHistory. After the first 20 are stored, page loads make 0
 * Match-v5 calls.
 */
import { prisma } from "./prisma";
import { riotAccountService } from "./riot-account";
import { riotDataService, type MasteryEntry, type MatchDetail } from "./riot-data";
import { getChampionById, getChampionIconUrl, getLatestDDragonVersion, getProfileIconUrl } from "./riot-datadragon";
import { cacheGet, cacheSet, cacheInvalidate, CacheTTL } from "./riot-profile-cache";
import type { RiotRegion } from "./riot-service";

export interface RankedSummary {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
  winrate: number;
  hotStreak: boolean;
}

export interface TopChampionSummary {
  championId: number;
  name: string;
  title: string;
  level: number;
  points: number;
  iconUrl: string;
  /** Whether the seasonal mastery chest has already been granted for this champion. */
  chestGranted: boolean;
  /** Number of mastery tokens earned toward the next hextech chest. */
  tokensEarned: number;
  /** Riot epoch ms of the last game played on this champion (0 = never). */
  lastPlayTime: number;
  /** Points accumulated within the current mastery level. */
  pointsSinceLastLevel: number;
  /** Points remaining until the next mastery level (Infinity for capped levels like 5–7). */
  pointsUntilNextLevel: number;
}

export interface RecentMatchSummary {
  id: string;
  matchId: string;
  championName: string;
  championIconUrl: string;
  queueName: string;
  gameMode: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
  csPerMin: number;
  gameDurationMin: number;
  gameStartTimestamp: number;
  itemIds: number[];
  isTournament: boolean;
  tournamentId: string | null;
}

export interface LoLProfileData {
  gameName: string;
  tagLine: string;
  region: RiotRegion;
  summonerLevel: number;
  profileIconId: number;
  /** Resolved DDragon URL for the summoner's profile icon. Null/missing when the icon ID is unknown. */
  profileIconUrl?: string | null;
  ranked: {
    solo?: RankedSummary;
    flex?: RankedSummary;
  };
  topChampions: TopChampionSummary[];
  recentMatches: RecentMatchSummary[];
  aggregate: {
    wins: number;
    losses: number;
    total: number;
    winrate: number;
    avgKda: number;
    tournamentWins: number;
    tournamentLosses: number;
  };
  fromCache: boolean;
  cachedAt: number | null;
}

const EMPTY: LoLProfileData = {
  gameName: "", tagLine: "", region: "la1", summonerLevel: 0, profileIconId: 0,
  ranked: {}, topChampions: [], recentMatches: [],
  aggregate: { wins: 0, losses: 0, total: 0, winrate: 0, avgKda: 0, tournamentWins: 0, tournamentLosses: 0 },
  fromCache: false, cachedAt: null,
};

// ─── Queue name translation ──────────────────────────────────────────────────

/**
 * Human-readable Spanish name for a given Riot queueId / gameMode.
 * gameMode is the more reliable signal (newer queues); queueId is fallback.
 */
export function getQueueName(queueId: number, gameMode: string): string {
  if (gameMode === "ARAM") return "ARAM";
  if (gameMode === "URF") return "URF";
  if (gameMode === "ARURF") return "URF Aleatorio";
  if (gameMode === "PRACTICETOOL") return "Herramientas";
  if (gameMode === "TUTORIAL") return "Tutorial";
  if (gameMode === "CHERRY") return "Arena 2v2v2v2";
  const QUEUE: Record<number, string> = {
    400: "Normal 5v5 Draft",
    420: "Clasificatoria Solo/Duo",
    430: "Normal 5v5 Blind",
    440: "Clasificatoria Flex 5v5",
    450: "ARAM",
    700: "Clash",
    720: "ARAM Clash",
    870: "ARAM Custom",
    900: "URF",
    1020: "One for All",
    1300: "Nexus Blitz",
    1400: "Ultimate Spellbook",
    1700: "Arena 2v2v2v2",
  };
  return QUEUE[queueId] ?? gameMode;
}

// ─── Persistent history helpers ──────────────────────────────────────────────

/**
 * Build a CommunityDragon URL for a given champion + skin. CommunityDragon
 * hosts the full splash art catalog and serves it via Cloudflare with CORS
 * open, so we can hot-link directly from the browser (no API key, no rate
 * limit observed in normal use). DDragon's `/img/splash/` path started
 * returning HTTP 403 "AccessDenied" on 2026-07-15; CDragon's
 * `latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/...`
 * path is the drop-in replacement and is still serving as of 2026-07-16.
 *
 * Path template:
 *   /plugins/rcp-be-lol-game-data/global/default/assets/characters/{nameLower}/skins/skin{num}/images/{nameLower}_splash_uncentered_{num}.jpg
 *
 * Notes on naming:
 *   - DDragon's `champ.id` is PascalCase (e.g. "TwistedFate", "DrMundo",
 *     "KhaZix", "LeeSin", "MonkeyKing"). CommunityDragon uses the
 *     all-lowercase form, NO hyphens, NO underscores between words. The
 *     simple `.toLowerCase()` is sufficient for every champion in 2026.
 *   - Some DDragon "skins" are chromas (variants of a base skin) and do
 *     NOT have their own assets on CommunityDragon. Calling code should
 *     resolve the chroma to its base skin number (typically the parent
 *     id's "num" minus the chroma offset) before constructing the URL.
 *     This function will return a URL regardless — the caller verifies
 *     with a HEAD if it needs to be sure the image exists.
 */
export function buildCommunityDragonSplashUrl(
  championId: string, // DDragon champion id, PascalCase, e.g. "TwistedFate"
  skinNum: number,    // DDragon skin num, e.g. 25 for Crime City Nightmare
): string {
  const lower = championId.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/${lower}/skins/skin${skinNum}/images/${lower}_splash_uncentered_${skinNum}.jpg`;
}

/**
 * Pick a stable random skin for the user's top mastery champion. The seed
 * is stored on User.riotSkinSeed and rotated on every manual refresh.
 *
 * Returns a CommunityDragon URL (NOT DDragon — DDragon /img/splash/ paths
 * have been 403 since 2026-07-15). The function resolves chroma variants
 * to their base skin (because CommunityDragon only ships one splash per
 * skin family, not per chroma). The skin name returned is the
 * user-visible variant name so the UI shows "Crime City Nightmare
 * Twisted Fate (Pearl)" rather than the generic base.
 */
export async function getRandomSplashForTopChampion(
  topChampionId: number,
  seed: number,
): Promise<{ url: string; skinName: string; skinNum: number } | null> {
  // Use getChampionById (not getChampionJson) so the lazy per-champion
  // detail fetch runs when the bulk JSON omits `skins`. DDragon's
  // `champion.json` endpoint strips skins to keep the payload small.
  const { getChampionById } = await import("./riot-datadragon");
  const champ = await getChampionById(topChampionId);
  if (!champ || !Array.isArray(champ.skins) || champ.skins.length === 0) return null;
  const pool = champ.skins; // includes default (id "0", num 0)
  const idx = ((seed % pool.length) + pool.length) % pool.length;
  const skin = pool[idx];

  // Resolve a chroma variant to its base skin number. CommunityDragon
  // stores a single splash per skin family, so a chroma like "Crime
  // City Nightmare Twisted Fate (Pearl)" (DDragon num 32) shares the
  // base splash with "Crime City Nightmare Twisted Fate" (num 25). We
  // walk backwards from the chroma to find the most recent skin with
  // `chromas: true` (the base marker); if none is found, we fall back
  // to the chroma's own num and let the browser 404 — the gradient
  // overlay still renders.
  let assetNum = skin.num;
  if (!skin.chromas) {
    for (let i = idx - 1; i >= 0; i--) {
      if (pool[i].chromas) {
        assetNum = pool[i].num;
        break;
      }
    }
  }

  const skinName = skin.name === "default" ? `${champ.name} (Original)` : skin.name;
  return {
    url: buildCommunityDragonSplashUrl(champ.id, assetNum),
    skinName,
    skinNum: skin.num,
  };
}

/**
 * Read the last 20 matches from PlayerMatchHistory. If the user has fewer than
 * 20 stored AND `topUpFromRiot` is true, fetch the missing ones from Riot
 * and persist them. Tournament matches (isTournament=true) stay; they're
 * never overwritten.
 */
async function getRecentMatchesFromDB(args: {
  userId: string;
  region: RiotRegion;
  puuid: string;
  topUpFromRiot: boolean;
}): Promise<Array<{
  id: string; matchId: string; championId: number; championName: string;
  queueId: number; queueName: string; gameMode: string;
  gameStartTimestamp: Date; gameDurationMin: number;
  win: boolean; kills: number; deaths: number; assists: number;
  cs: number; csPerMin: number; itemIds: string;
  summoner1Perk: number | null; summoner2Perk: number | null;
  isTournament: boolean; tournamentId: string | null;
}>> {
  const rows = await prisma.playerMatchHistory.findMany({
    where: { userId: args.userId },
    orderBy: { gameStartTimestamp: "desc" },
    take: 20,
  });
  if (rows.length >= 20 || !args.topUpFromRiot) {
    return rows as unknown as Awaited<ReturnType<typeof getRecentMatchesFromDB>>;
  }
  // Top-up: fetch 25 most recent, skip the ones we already have
  const ids = await riotDataService.getRecentMatchIds(args.puuid, args.region, 25);
  const have = new Set(rows.map((r) => r.matchId));
  const newIds = ids.filter((id) => !have.has(id)).slice(0, 20 - rows.length);
  for (const matchId of newIds) {
    try {
      const m = await riotDataService.getMatch(matchId, args.region, args.puuid);
      if (!m) continue;
      const champ = await getChampionById(m.championId);
      const csPerMin =
        m.gameDuration > 0
          ? Math.round((m.cs / m.gameDuration) * 60 * 10) / 10
          : 0;
      await prisma.playerMatchHistory.upsert({
        where: { userId_matchId: { userId: args.userId, matchId } },
        update: {}, // preserve tournament linkage if any
        create: {
          userId: args.userId,
          matchId,
          region: args.region,
          queueId: m.queueId,
          queueName: getQueueName(m.queueId, m.gameMode),
          gameMode: m.gameMode,
          gameStartTimestamp: new Date(m.gameStartTimestamp),
          gameDurationMin: Math.round(m.gameDuration / 60),
          championId: m.championId,
          championName: champ?.name ?? `Champion ${m.championId}`,
          win: m.win,
          kills: m.kills,
          deaths: m.deaths,
          assists: m.assists,
          cs: m.cs,
          csPerMin,
          itemIds: JSON.stringify(m.itemIds),
          summoner1Perk: m.summoner1DPerk,
          summoner2Perk: m.summoner2DPerk,
          isTournament: false,
        },
      });
    } catch (err) {
      console.warn(`[riot-profile] failed to top-up match ${matchId}:`, err);
    }
  }
  const finalRows = await prisma.playerMatchHistory.findMany({
    where: { userId: args.userId },
    orderBy: { gameStartTimestamp: "desc" },
    take: 20,
  });
  return finalRows as unknown as Awaited<ReturnType<typeof getRecentMatchesFromDB>>;
}

// ─── Main loader ─────────────────────────────────────────────────────────────

export async function loadLoLProfile(
  userId: string,
  opts?: { skipCache?: boolean; topUpFromRiot?: boolean },
): Promise<LoLProfileData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      riotPuuid: true, riotGameName: true, riotTagLine: true,
      riotRegion: true, riotSummonerId: true, riotIconId: true,
    },
  });
  if (!user || !user.riotPuuid || !user.riotRegion) {
    return null;
  }
  const region = user.riotRegion as RiotRegion;
  const cacheKey = `profile:${userId}:lol:v3`;

  if (!opts?.skipCache) {
    const cached = await cacheGet<LoLProfileData>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true, cachedAt: Date.now() };
    }
  }

  // 1. Ranked (fresh — changes every game). Falls back to /entries/by-puuid
  //    when Summoner-v4 omitted the `id` field (some dev keys).
  const ranked = user.riotSummonerId
    ? await riotDataService.getRankedEntries(user.riotSummonerId, region)
    : await riotDataService.getRankedEntriesByPuuid(user.riotPuuid, region);
  const rankedBlock: LoLProfileData["ranked"] = {};
  for (const e of ranked) {
    const total = e.wins + e.losses;
    const winrate = total > 0 ? Math.round((e.wins / total) * 100) : 0;
    const obj: RankedSummary = {
      tier: e.tier, rank: e.rank, lp: e.leaguePoints,
      wins: e.wins, losses: e.losses, winrate, hotStreak: e.hotStreak,
    };
    if (e.queueType === "RANKED_SOLO_5x5") rankedBlock.solo = obj;
    else if (e.queueType === "RANKED_FLEX_SR") rankedBlock.flex = obj;
  }

  // 2. Top mastery (1h cache)
  const masteryCacheKey = `user:${userId}:mastery`;
  let mastery = await cacheGet<MasteryEntry[]>(masteryCacheKey);
  if (!mastery) {
    mastery = await riotDataService.getTopMastery(user.riotPuuid, region, 5);
    await cacheSet(masteryCacheKey, mastery, CacheTTL.MASTERY);
  }
  const topChampions: TopChampionSummary[] = await Promise.all(
    mastery.map(async (m) => {
      const champ = await getChampionById(m.championId);
      const iconUrl = (await getChampionIconUrl(m.championId)) ?? "";
      return {
        championId: m.championId,
        name: champ?.name ?? `Champion ${m.championId}`,
        title: champ?.title ?? "",
        level: m.championLevel,
        points: m.championPoints,
        iconUrl,
        chestGranted: m.chestGranted,
        tokensEarned: m.tokensEarned,
        lastPlayTime: m.lastPlayTime,
        pointsSinceLastLevel: m.championPointsSinceLastLevel,
        pointsUntilNextLevel: m.championPointsUntilNextLevel,
      };
    }),
  );

  // 3. Recent matches from PlayerMatchHistory (no Riot call unless top-up)
  const dbMatches = await getRecentMatchesFromDB({
    userId, region, puuid: user.riotPuuid,
    topUpFromRiot: opts?.topUpFromRiot ?? false,
  });
  const recentMatches: RecentMatchSummary[] = await Promise.all(
    dbMatches.map(async (m) => {
      const iconUrl = (await getChampionIconUrl(m.championId)) ?? "";
      const itemIds = safeJsonParseArray(m.itemIds);
      return {
        id: m.id,
        matchId: m.matchId,
        championName: m.championName,
        championIconUrl: iconUrl,
        queueName: m.queueName,
        gameMode: m.gameMode,
        win: m.win,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        kda: m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths,
        cs: m.cs,
        csPerMin: m.csPerMin,
        gameDurationMin: m.gameDurationMin,
        gameStartTimestamp: m.gameStartTimestamp.getTime(),
        itemIds,
        isTournament: m.isTournament,
        tournamentId: m.tournamentId,
      };
    }),
  );

  // 4. Aggregates
  const wins = recentMatches.filter((m) => m.win).length;
  const losses = recentMatches.length - wins;
  const total = recentMatches.length;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const avgKda =
    total > 0
      ? Math.round((recentMatches.reduce((s, m) => s + m.kda, 0) / total) * 100) / 100
      : 0;
  const tournamentWins = recentMatches.filter((m) => m.isTournament && m.win).length;
  const tournamentLosses = recentMatches.filter((m) => m.isTournament && !m.win).length;

  // 5. Summoner level / icon (fresh, no cache)
  const summoner = await riotAccountService.getSummonerByPuuid(user.riotPuuid, region);
  const summonerLevel = summoner?.summonerLevel ?? 0;
  const profileIconId = summoner?.profileIconId ?? user.riotIconId ?? 0;
  const profileIconUrl = await getProfileIconUrl(profileIconId);

  const data: LoLProfileData = {
    gameName: user.riotGameName ?? "",
    tagLine: user.riotTagLine ?? "",
    region,
    summonerLevel,
    profileIconId,
    profileIconUrl,
    ranked: rankedBlock,
    topChampions,
    recentMatches,
    aggregate: { wins, losses, total, winrate, avgKda, tournamentWins, tournamentLosses },
    fromCache: false,
    cachedAt: Date.now(),
  };

  await cacheSet(cacheKey, data, CacheTTL.STICKY);
  return data;
}

function safeJsonParseArray(s: string): number[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as number[]) : [];
  } catch {
    return [];
  }
}

export function emptyLoLProfile(): LoLProfileData {
  return { ...EMPTY };
}

// ─── Tournament history writer (used by /api/riot/callback) ──────────────────

/**
 * Persist a single match to PlayerMatchHistory. Used by the Riot callback
 * (Task 8b) when a tournament match completes. Idempotent: re-running with
 * the same (userId, matchId) updates stats but preserves tournament linkage.
 */
export async function recordPlayerMatch(args: {
  userId: string;
  matchId: string;
  region: RiotRegion;
  queueId: number;
  gameMode: string;
  gameStartTimestamp: Date;
  gameDurationMin: number;
  championId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  itemIds: number[];
  summoner1Perk: number;
  summoner2Perk: number;
  isTournament: boolean;
  tournamentId?: string | null;
  matchGamersLandId?: string | null;
  gameName?: string | null;
  tagLine?: string | null;
  role?: string | null;
}): Promise<void> {
  const champ = await getChampionById(args.championId);
  const csPerMin =
    args.gameDurationMin > 0
      ? Math.round((args.cs / (args.gameDurationMin * 60)) * 60 * 10) / 10
      : 0;
  await prisma.playerMatchHistory.upsert({
    where: { userId_matchId: { userId: args.userId, matchId: args.matchId } },
    update: {
      win: args.win,
      kills: args.kills,
      deaths: args.deaths,
      assists: args.assists,
      cs: args.cs,
      itemIds: JSON.stringify(args.itemIds),
    },
    create: {
      userId: args.userId,
      matchId: args.matchId,
      region: args.region,
      gameName: args.gameName ?? null,
      tagLine: args.tagLine ?? null,
      queueId: args.queueId,
      queueName: getQueueName(args.queueId, args.gameMode),
      gameMode: args.gameMode,
      gameStartTimestamp: args.gameStartTimestamp,
      gameDurationMin: args.gameDurationMin,
      championId: args.championId,
      championName: champ?.name ?? `Champion ${args.championId}`,
      role: args.role ?? null,
      win: args.win,
      kills: args.kills,
      deaths: args.deaths,
      assists: args.assists,
      cs: args.cs,
      csPerMin,
      itemIds: JSON.stringify(args.itemIds),
      summoner1Perk: args.summoner1Perk,
      summoner2Perk: args.summoner2Perk,
      isTournament: args.isTournament,
      tournamentId: args.tournamentId ?? null,
      matchGamersLandId: args.matchGamersLandId ?? null,
    },
  });
}

// Re-export cache helpers so the route can call them too
export { cacheInvalidate };
