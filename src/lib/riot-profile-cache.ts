/**
 * DB-backed cache for Riot API responses.
 *
 * Two-tier: L1 in-process Map for hot reads, L2 MariaDB for cross-process
 * persistence and restarts. Writes go to both. Reads check L1 first, then
 * L2, then promote the value into L1. This keeps the connection pool from
 * saturating when LoLProfileSection fans out 25+ `getChampionIconUrl` calls
 * in parallel.
 */
import { prisma } from "./prisma";

export const CacheTTL = {
  /** Data Dragon CDN content (versions, champion.json). */
  DDRAGON: 1000 * 60 * 60 * 24, // 24h
  /** Champion mastery for a user (changes slowly). */
  MASTERY: 1000 * 60 * 60, // 1h
  /** Sticky profile JSON — only invalidated by manual refresh. */
  STICKY: 1000 * 60 * 60 * 24 * 7, // 7 days, but the user refresh button forces a new key
  /** Short-lived: anything that should re-fetch on every page load. */
  SHORT: 1000 * 60, // 1m
} as const;

interface L1Entry {
  value: unknown;
  expiresAt: number;
}

// L1: capped at 200 entries to bound memory. On overflow, evict oldest-inserted.
const L1 = new Map<string, L1Entry>();
const L1_MAX = 200;
function l1Get(key: string): unknown | null {
  const e = L1.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    L1.delete(key);
    return null;
  }
  return e.value;
}
function l1Set(key: string, value: unknown, ttlMs: number): void {
  if (L1.size >= L1_MAX) {
    // Drop the oldest insertion (Map preserves insertion order)
    const firstKey = L1.keys().next().value;
    if (firstKey !== undefined) L1.delete(firstKey);
  }
  L1.set(key, { value, expiresAt: Date.now() + ttlMs });
}
function l1Delete(key: string): void {
  L1.delete(key);
}
function l1DeletePrefix(prefix: string): void {
  for (const k of L1.keys()) {
    if (k.startsWith(prefix)) L1.delete(k);
  }
}

/** Read a cached value by key. Returns null if missing or expired. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // L1 first
  const l1 = l1Get(key) as T | null;
  if (l1 !== null && l1 !== undefined) return l1;
  // L2 (DB)
  const row = await prisma.riotCache.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    // Best-effort delete so the table doesn't grow with stale rows.
    prisma.riotCache.delete({ where: { key } }).catch(() => {});
    l1Delete(key);
    return null;
  }
  let parsed: T;
  try {
    parsed = JSON.parse(row.value) as T;
  } catch {
    return null;
  }
  // Promote to L1 with remaining TTL
  const remainingMs = Math.max(0, row.expiresAt.getTime() - Date.now());
  l1Set(key, parsed, remainingMs);
  return parsed;
}

/** Write a value with a TTL (in ms). */
const inFlight = new Map<string, Promise<void>>();
export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  // Coalesce concurrent writes to the same key — without this, parallel
  // getChampionById calls in `Promise.all` race on the primary key and
  // MariaDB throws ER_DUP_ENTRY (P2002). Awaits the prior in-flight write.
  const pending = inFlight.get(key);
  if (pending) return pending;
  const expiresAt = new Date(Date.now() + ttlMs);
  const serialized = JSON.stringify(value);
  // L1 first (synchronous, no DB roundtrip) — keeps the hot path cheap.
  l1Set(key, value, ttlMs);
  const p = (async () => {
    try {
      await prisma.riotCache.upsert({
        where: { key },
        update: { value: serialized, expiresAt, updatedAt: new Date() },
        create: { key, value: serialized, expiresAt, updatedAt: new Date() },
      });
    } catch (err) {
      // If a concurrent process beat us, swallow the duplicate-entry race
      // (P2002). The newer value will win on the next call.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return;
      }
      throw err;
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Force-remove a key (used by the manual refresh endpoint). */
export async function cacheInvalidate(key: string): Promise<void> {
  l1Delete(key);
  await prisma.riotCache
    .delete({ where: { key } })
    .catch(() => {/* row didn't exist, fine */});
}

/** Bulk invalidation (e.g. when the user unlinks). */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  l1DeletePrefix(prefix);
  await prisma.riotCache.deleteMany({ where: { key: { startsWith: prefix } } });
}
