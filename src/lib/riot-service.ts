/**
 * Riot Tournament API Service
 *
 * Wraps the Riot Tournament Stub (and Production) API endpoints for creating
 * tournaments, generating codes, and managing lobby events.
 *
 * @see https://developer.riotgames.com/apis#tournament-stub-v5
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Whether to use the Tournament Stub API or the Production Tournament API. */
export type RiotMode = "stub" | "production";

/** Configuration for generating tournament codes. */
export interface RiotCodeConfig {
  /**
   * The map on which the match will be played.
   * - SUMMONERS_RIFT: Standard 5v5 map.
   * - HOWLING_ABYSS: ARAM map.
   */
  mapType: "SUMMONERS_RIFT" | "HOWLING_ABYSS";

  /**
   * The pick type for the match.
   * - TOURNAMENT_DRAFT: Tournament-style draft (alternating bans/picks).
   * - ALL_RANDOM: Champions are randomly assigned.
   * - BLIND_PICK: Both teams pick simultaneously (no bans).
   */
  pickType: "TOURNAMENT_DRAFT" | "ALL_RANDOM" | "BLIND_PICK";

  /**
   * The spectator mode for the match.
   * - NONE: No spectators allowed.
   * - LOBBY_ONLY: Only lobby participants can spectate.
   * - ALL: Anyone can spectate.
   */
  spectatorType: "NONE" | "LOBBY_ONLY" | "ALL";

  /** Number of players per team (e.g. 5 for Summoner's Rift, 1 for 1v1). */
  teamSize: number;

  /** Optional list of PUUIDs allowed to participate in the tournament. */
  allowedPUUIDs?: string[];
}

/** Details returned for a single tournament code. */
export interface RiotCodeDetails {
  /** The tournament code string. */
  code: string;
  /** Serialized spectator configuration. */
  spectators: { lobbyPermitted?: boolean; recordPermitted?: boolean };
  /** Serialized lobby configuration. */
  lobby: { lobbyName?: string };
  /** The map type for the match. */
  map: "SUMMONERS_RIFT" | "HOWLING_ABYSS";
  /** The region in which the match takes place. */
  region: string;
  /** The pick type for the match. */
  pickType: "TOURNAMENT_DRAFT" | "ALL_RANDOM" | "BLIND_PICK";
  /** The spectator type for the match. */
  spectatorType: "NONE" | "LOBBY_ONLY" | "ALL";
  /** The team size for the match. */
  teamSize: number;
  /** The tournament ID this code belongs to. */
  tournamentId: number;
}

/** A lobby event emitted during the tournament lifecycle. */
export interface RiotLobbyEvent {
  /** The type of event (e.g. PracticeGameCreated, GameStart, etc.). */
  eventType: string;
  /** Unix timestamp of the event. */
  timestamp: number;
  /** The summoner name associated with the event, if any. */
  summonerName?: string;
  /** The PUUID of the player, if any. */
  puuid?: string;
  /** The team ID, if applicable. */
  teamId?: number;
}

/** Shape of the provider creation response. */
interface ProviderResponse {
  id: number;
}

/** Shape of the tournament creation response. */
interface TournamentResponse {
  id: number;
}

/** Shape of the lobby events response. */
type LobbyEventsResponse = RiotLobbyEvent[];

// ─── Constants ───────────────────────────────────────────────────────────────

const RIOT_API_BASE_URLS: Record<RiotMode, string> = {
  stub: "https://americas.api.riotgames.com/lol/tournament-stub/v5",
  production: "https://americas.api.riotgames.com/lol/tournament/v5",
};

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Small delay helper used between retries.
 * @param ms - Milliseconds to wait.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a standard set of headers for Riot API requests.
 */
function riotHeaders(apiKey: string): Record<string, string> {
  return {
    "X-Riot-Token": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ─── RiotService ─────────────────────────────────────────────────────────────

/**
 * Service for interacting with the Riot Tournament API.
 *
 * Supports both the **Stub** API (for testing without a live tournament) and
 * the **Production** API once the tournament is officially registered with Riot.
 *
 * Every public method includes structured error handling — API failures log the
 * error to console and are surfaced via thrown `RiotApiError` instances so
 * callers can handle them appropriately.
 */
export class RiotService {
  private readonly apiKey: string;
  private readonly mode: RiotMode;

  /**
   * @param apiKey - A valid Riot API key (found at https://developer.riotgames.com).
   * @param mode   - Whether to use the Tournament Stub API or Production API.
   */
  constructor(apiKey: string, mode: RiotMode = "stub") {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("RiotService: apiKey is required");
    }
    this.apiKey = apiKey;
    this.mode = mode;
  }

  // ── Base URL ───────────────────────────────────────────────────────────────

  /**
   * The base URL for the Riot Tournament API, selected by mode.
   * - **stub**:       `https://americas.api.riotgames.com/lol/tournament-stub/v5`
   * - **production**: `https://americas.api.riotgames.com/lol/tournament/v5`
   */
  private get baseUrl(): string {
    return RIOT_API_BASE_URLS[this.mode];
  }

  // ── Provider ───────────────────────────────────────────────────────────────

  /**
   * Create a tournament provider.
   *
   * A provider represents a tournament-organizer integration. Riot requires this
   * as the first step so they can associate callback URLs and rate limits with
   * your application.
   *
   * @param region      - The region code (e.g. "NA1", "EUW1", "KR").
   * @param callbackUrl - URL Riot will POST game-end events to.
   * @returns The numeric provider ID assigned by Riot.
   *
   * @example
   * ```ts
   * const providerId = await riotService.createProvider("NA1", "https://gamersland.test/callback");
   * ```
   */
  async createProvider(region: string, callbackUrl: string): Promise<number> {
    const url = `${this.baseUrl}/providers`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: riotHeaders(this.apiKey),
        body: JSON.stringify({ region, url: callbackUrl }),
      });

      const data = (await response.json()) as ProviderResponse;
      return data.id;
    } catch (error) {
      const message = this.formatError(error, "createProvider");
      console.error(`[RiotService] createProvider failed: ${message}`);
      throw new RiotApiError("createProvider", message);
    }
  }

  // ── Tournament ─────────────────────────────────────────────────────────────

  /**
   * Create a tournament under a previously registered provider.
   *
   * A tournament groups a set of codes together. Riot uses the tournament
   * context for reporting and rate-limit management.
   *
   * @param providerId - The provider ID returned by `createProvider`.
   * @param name       - A human-readable name for the tournament.
   * @returns The numeric tournament ID assigned by Riot.
   *
   * @example
   * ```ts
   * const tournamentId = await riotService.createTournament(providerId, "GamersLand Cup #42");
   * ```
   */
  async createTournament(providerId: number, name: string): Promise<number> {
    const url = `${this.baseUrl}/tournaments`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: riotHeaders(this.apiKey),
        body: JSON.stringify({ providerId, name }),
      });

      const data = (await response.json()) as TournamentResponse;
      return data.id;
    } catch (error) {
      const message = this.formatError(error, "createTournament");
      console.error(`[RiotService] createTournament failed: ${message}`);
      throw new RiotApiError("createTournament", message);
    }
  }

  // ── Generate Codes ─────────────────────────────────────────────────────────

  /**
   * Generate one or more tournament codes for a given tournament.
   *
   * Each code represents a single game lobby. Players join via the tournament
   * code in the League of Legends client.
   *
   * @param tournamentId - The tournament ID returned by `createTournament`.
   * @param count        - How many codes to generate.
   * @param config       - Configuration for the match (map, pick type, etc.).
   * @returns An array of tournament code strings.
   *
   * @example
   * ```ts
   * const codes = await riotService.generateCodes(tournamentId, 8, {
   *   mapType: "SUMMONERS_RIFT",
   *   pickType: "TOURNAMENT_DRAFT",
   *   spectatorType: "LOBBY_ONLY",
   *   teamSize: 5,
   * });
   * ```
   */
  async generateCodes(
    tournamentId: number,
    count: number,
    config: RiotCodeConfig,
  ): Promise<string[]> {
    const url = `${this.baseUrl}/codes?tournamentId=${tournamentId}`;

    const body: Record<string, unknown> = {
      count,
      mapType: config.mapType,
      pickType: config.pickType,
      spectatorType: config.spectatorType,
      teamSize: config.teamSize,
    };

    // Only include allowedPUUIDs when explicitly provided
    if (config.allowedPUUIDs && config.allowedPUUIDs.length > 0) {
      body.allowedPUUIDs = config.allowedPUUIDs;
    }

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: riotHeaders(this.apiKey),
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as string[];
      return data;
    } catch (error) {
      const message = this.formatError(error, "generateCodes");
      console.error(`[RiotService] generateCodes failed: ${message}`);
      throw new RiotApiError("generateCodes", message);
    }
  }

  // ── Get Code Info ──────────────────────────────────────────────────────────

  /**
   * Retrieve details about a specific tournament code.
   *
   * This includes the map, pick type, spectator mode, team size, and the
   * associated tournament ID.
   *
   * @param code - The tournament code string to look up.
   * @returns The parsed code details object.
   *
   * @example
   * ```ts
   * const info = await riotService.getCodeInfo("TOURNAMENT_CODE_ABC");
   * console.log(info.map, info.pickType);
   * ```
   */
  async getCodeInfo(code: string): Promise<RiotCodeDetails> {
    const url = `${this.baseUrl}/codes/${encodeURIComponent(code)}`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: riotHeaders(this.apiKey),
      });

      const data = (await response.json()) as RiotCodeDetails;
      return data;
    } catch (error) {
      const message = this.formatError(error, "getCodeInfo");
      console.error(`[RiotService] getCodeInfo failed: ${message}`);
      throw new RiotApiError("getCodeInfo", message);
    }
  }

  // ── Get Lobby Events ───────────────────────────────────────────────────────

  /**
   * Retrieve lobby events for a specific tournament code.
   *
   * Events include game creation, player joins, player swaps, and game start.
   * The events are returned as an array ordered by timestamp (oldest first).
   *
   * @param code - The tournament code string.
   * @returns An array of lobby events.
   *
   * @example
   * ```ts
   * const events = await riotService.getLobbyEvents("TOURNAMENT_CODE_ABC");
   * // → [{ eventType: "PracticeGameCreated", timestamp: 1700000000 }, …]
   * ```
   */
  async getLobbyEvents(code: string): Promise<RiotLobbyEvent[]> {
    const url = `${this.baseUrl}/codes/${encodeURIComponent(code)}/lobby-events`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: riotHeaders(this.apiKey),
      });

      const data = (await response.json()) as LobbyEventsResponse;
      return data;
    } catch (error) {
      const message = this.formatError(error, "getLobbyEvents");
      console.error(`[RiotService] getLobbyEvents failed: ${message}`);
      throw new RiotApiError("getLobbyEvents", message);
    }
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  /**
   * Wrapped `fetch` with retry logic for transient failures.
   *
   * Retries on 429 (rate-limit), 502, 503, and 504 (server-side)
   * status codes up to `MAX_RETRIES` times with a small back-off delay.
   *
   * Any non-2xx response that isn't recovered by retries is thrown as an
   * error with the HTTP status and response body for debugging.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = MAX_RETRIES,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const signal = controller.signal;

    try {
      const response = await fetch(url, { ...init, signal });

      // 2xx → success
      if (response.ok) {
        return response;
      }

      // Retryable status codes
      const retryable = [429, 502, 503, 504];
      if (retries > 0 && retryable.includes(response.status)) {
        console.warn(
          `[RiotService] HTTP ${response.status} on ${url}, retrying… (${retries} left)`,
        );
        await delay(RETRY_DELAY_MS);
        return this.fetchWithRetry(url, init, retries - 1);
      }

      // Non-retryable error — extract body for a helpful message
      const body = await response.text().catch(() => "(unreadable body)");
      throw new Error(
        `Riot API responded with HTTP ${response.status}: ${body}`,
      );
    } catch (error) {
      if (error instanceof RiotApiError) throw error;
      if ((error as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Normalise arbitrary thrown values into a human-readable message string,
   * preserving the context of where the error originated.
   */
  private formatError(error: unknown, context: string): string {
    if (error instanceof RiotApiError) {
      return error.message;
    }
    if (error instanceof TypeError) {
      return `Network error (${context}): ${error.message}`;
    }
    if (error instanceof Error) {
      return `${error.message}`;
    }
    return String(error);
  }
}

// ─── RiotApiError ────────────────────────────────────────────────────────────

/**
 * Structured error thrown by `RiotService` methods.
 *
 * Callers can catch this type to distinguish API errors from other
 * unexpected runtime errors.
 */
export class RiotApiError extends Error {
  /** The name of the service method that produced the error. */
  public readonly method: string;

  constructor(method: string, message: string) {
    super(`[${method}] ${message}`);
    this.name = "RiotApiError";
    this.method = method;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

/**
 * Default callback URL for use with `createProvider()`.
 * Auto-built from NEXT_PUBLIC_APP_URL when RIOT_CALLBACK_URL is not set.
 * Strips trailing slash and appends `/api/riot/callback`.
 */
function buildDefaultCallbackUrl(): string {
  const fromEnv = process.env.RIOT_CALLBACK_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/api/riot/callback` : "https://gamersland.tabtap.dev/api/riot/callback";
}

export const RIOT_CALLBACK_URL: string = buildDefaultCallbackUrl();

/**
 * Default singleton instance of the RiotService, initialised from environment
 * variables.
 *
 * Required env vars:
 * - `RIOT_API_KEY` — Your Riot Games API key.
 *
 * Optional env vars:
 * - `RIOT_MODE` — Either `"stub"` (default) or `"production"`.
 *
 * @throws If `RIOT_API_KEY` is not set when this module is first loaded.
 */
export const riotService: RiotService = (() => {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RIOT_API_KEY environment variable is required. " +
        "Set it in .env.local or your deployment environment.",
    );
  }

  const mode = (process.env.RIOT_MODE ?? "stub") as RiotMode;
  const validatedMode: RiotMode =
    mode === "production" ? "production" : "stub";

  return new RiotService(apiKey, validatedMode);
})();

// ─── Region mapping (Account-v1, Summoner-v4, League-v4, Mastery-v4) ─────────

/**
 * Riot platform/region codes used for endpoints that take a regional routing value
 * (e.g. /lol/summoner/v4/summoners/by-puuid/{puuid}, /lol/league/v4/entries/...).
 * LAN = Latin America North (Mexico, Central America, etc.).
 */
export type RiotRegion =
  | "br1"   // Brazil
  | "eun1"  // EU Nordic & East
  | "euw1"  // EU West
  | "jp1"   // Japan
  | "kr"    // Korea
  | "la1"   // Latin America North
  | "la2"   // Latin America South
  | "na1"   // North America
  | "oc1"   // Oceania
  | "tr1"   // Turkey
  | "ru"    // Russia
  | "ph2"   // Philippines
  | "sg2"   // Singapore
  | "th2"   // Thailand
  | "tw2"   // Taiwan
  | "vn2";  // Vietnam

export const ALL_REGIONS: RiotRegion[] = [
  "br1", "eun1", "euw1", "jp1", "kr", "la1", "la2", "na1",
  "oc1", "tr1", "ru", "ph2", "sg2", "th2", "tw2", "vn2",
];

/**
 * Map from Account-v1 regional group to the platform values that share the
 * same match-v5 cluster. Account-v1 is queried on the regional cluster
 * (americas/asia/europe), while Summoner/League/Mastery are queried on
 * the platform value.
 */
const REGION_TO_REGIONAL: Record<RiotRegion, "americas" | "asia" | "europe"> = {
  br1: "americas", la1: "americas", la2: "americas", na1: "americas",
  jp1: "asia", kr: "asia", oc1: "asia", ph2: "asia", sg2: "asia", th2: "asia", tw2: "asia", vn2: "asia",
  eun1: "europe",euw1: "europe", tr1: "europe", ru: "europe",
};

export function getRegionalCluster(region: RiotRegion): "americas" | "asia" | "europe" {
  return REGION_TO_REGIONAL[region];
}

/**
 * Internal shared fetch helper used by the Account/Summoner/League/Match services.
 * Reads RIOT_API_KEY lazily and never throws on missing key (callers can
 * detect with .ok === false).
 */
export const RIOT_API_KEY_HELPER = {
  get(): string | null {
    return process.env.RIOT_API_KEY ?? null;
  },
};
