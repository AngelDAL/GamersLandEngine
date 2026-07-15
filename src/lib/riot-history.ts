/**
 * Admin / organizer helpers for querying the persistent PlayerMatchHistory.
 *
 * These give the team easy access to:
 *  - One user's match history (with optional tournament filter)
 *  - Every match played in a specific tournament
 *  - Per-user tournament statistics (wins, KDA, top champs)
 *  - System-wide tournament activity feed
 */
import { prisma } from "./prisma";
import type { PlayerMatchHistory } from "@/generated/prisma/client";

/** Get the most recent N matches for a user, across all queues. */
export async function getUserMatchHistory(
  userId: string,
  opts: { limit?: number; onlyTournament?: boolean } = {},
): Promise<PlayerMatchHistory[]> {
  return prisma.playerMatchHistory.findMany({
    where: {
      userId,
      ...(opts.onlyTournament ? { isTournament: true } : {}),
    },
    orderBy: { gameStartTimestamp: "desc" },
    take: opts.limit ?? 50,
  });
}

/** Get every match that was played in a specific tournament. */
export async function getTournamentMatchHistory(
  tournamentId: string,
): Promise<PlayerMatchHistory[]> {
  return prisma.playerMatchHistory.findMany({
    where: { tournamentId, isTournament: true },
    orderBy: { gameStartTimestamp: "desc" },
  });
}

export interface UserTournamentStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKda: number;
  topChamps: Array<{ name: string; games: number; wins: number; winrate: number }>;
  tournamentsPlayed: number;
}

/** Stats: how many tournament matches has this user played in total? */
export async function getUserTournamentStats(
  userId: string,
): Promise<UserTournamentStats> {
  const matches = await prisma.playerMatchHistory.findMany({
    where: { userId, isTournament: true },
    select: {
      win: true, kills: true, deaths: true, assists: true,
      championId: true, championName: true, tournamentId: true,
    },
  });
  const wins = matches.filter((m) => m.win).length;
  const total = matches.length;
  const losses = total - wins;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const avgKda =
    total > 0
      ? Math.round(
          (matches.reduce(
            (s, m) => s + (m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths),
            0,
          ) /
            total) *
            100,
        ) / 100
      : 0;

  // Top champions in tournaments
  const champCounts: Record<string, { name: string; games: number; wins: number }> = {};
  for (const m of matches) {
    if (!champCounts[m.championId]) {
      champCounts[m.championId] = { name: m.championName, games: 0, wins: 0 };
    }
    champCounts[m.championId].games++;
    if (m.win) champCounts[m.championId].wins++;
  }
  const topChamps = Object.values(champCounts)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      games: c.games,
      wins: c.wins,
      winrate: c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0,
    }));

  const tournamentsPlayed = new Set(
    matches.map((m) => m.tournamentId).filter((t): t is string => Boolean(t)),
  ).size;

  return { totalMatches: total, wins, losses, winrate, avgKda, topChamps, tournamentsPlayed };
}

/** All tournament matches across all users in the system (admin overview). */
export async function getAllTournamentMatches(opts: { limit?: number } = {}) {
  return prisma.playerMatchHistory.findMany({
    where: { isTournament: true },
    orderBy: { gameStartTimestamp: "desc" },
    take: opts.limit ?? 100,
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
      tournament: { select: { id: true, name: true } },
    },
  });
}

/** Count of matches and wins for a specific champion, all queues. */
export async function getUserChampionStats(
  userId: string,
  championId: number,
): Promise<{ games: number; wins: number; winrate: number } | null> {
  const matches = await prisma.playerMatchHistory.findMany({
    where: { userId, championId },
    select: { win: true },
  });
  if (matches.length === 0) return null;
  const wins = matches.filter((m) => m.win).length;
  return {
    games: matches.length,
    wins,
    winrate: Math.round((wins / matches.length) * 100),
  };
}
