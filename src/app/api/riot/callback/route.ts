import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TeamMatchResultEnum } from "@/generated/prisma/enums";
import { riotDataService, type MatchParticipant } from "@/lib/riot-data";
import { recordPlayerMatch } from "@/lib/riot-profile";
import type { RiotRegion } from "@/lib/riot-service";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Riot can send game result payloads in different shapes:
 *
 * **Stub API** (testing) — field names are camelCase:
 * ```json
 * {
 *   "tournamentCode": "STUB-CODE-123",
 *   "gameId": 123456,
 *   "participants": [
 *     { "puuid": "...", "summonerName": "Player1", "teamId": 100, ... }
 *   ],
 *   "winningTeam": 100
 * }
 * ```
 *
 * **Production API** — field names may be snake_case:
 * ```json
 * {
 *   "tournament_code": "...",
 *   "game_id": 123456,
 *   "winning_team": 100
 * }
 * ```
 *
 * The handler normalises both shapes before processing.
 */
interface RiotCallbackPayload {
  tournamentCode?: string;
  gameId?: number;
  participants?: RiotParticipant[];
  winningTeam?: number;
  /** Production API snake_case aliases */
  tournament_code?: string;
  game_id?: number;
  winning_team?: number;
  /** Allow any additional fields Riot may send */
  [key: string]: unknown;
}

interface RiotParticipant {
  puuid?: string;
  summonerName?: string;
  teamId?: number;
  champion?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  [key: string]: unknown;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * POST /api/riot/callback
 *
 * Webhook endpoint called by Riot when a tournament match completes.
 * No auth required — this is a server-to-server callback.
 *
 * Accepts both Stub and Production API payload shapes, logs the raw body
 * for debugging, and persists the result in the database.
 */
export async function POST(request: Request) {
  try {
    // 1. Parse the incoming payload
    const body: RiotCallbackPayload = await request.json();

    // 2. Log the callback for debugging (truncate to avoid flooding logs)
    console.log(`[RiotCallback] Received callback: ${JSON.stringify(body).slice(0, 500)}`);

    // 3. Normalise field names (Stub vs Production API)
    const tournamentCode = body.tournamentCode ?? body.tournament_code;
    const gameId = body.gameId ?? body.game_id;
    const winningTeam = body.winningTeam ?? body.winning_team;

    if (!tournamentCode) {
      console.warn(`[RiotCallback] Missing tournamentCode in callback payload`);
      return NextResponse.json({
        success: true,
        processed: false,
        reason: "missing tournamentCode",
      });
    }

    // 4. Find the match associated with this tournament code.
    //    We look up via the dedicated `riotCode` field on Match for a clean
    //    1:1 mapping between codes and matches.
    const match = await prisma.match.findFirst({
      where: { riotCode: tournamentCode },
      include: {
        round: {
          include: {
            tournament: {
              select: {
                id: true,
                riotTournamentId: true,
                riotMode: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      console.warn(
        `[RiotCallback] No match found with log="${tournamentCode}". ` +
          `gameId=${gameId ?? "N/A"}, winningTeam=${winningTeam ?? "N/A"}`,
      );
      // Always return 200 — Riot expects an acknowledgement
      return NextResponse.json({
        success: true,
        processed: false,
        reason: "match not found for tournament code",
      });
    }

    // 5. Determine which team won
    //    Riot uses team IDs 100 (blue) and 200 (red).
    //    In our Match model, team1Id corresponds to one side and team2Id to the other.
    const winningTeamId =
      winningTeam === 100
        ? match.team1Id
        : winningTeam === 200
          ? match.team2Id
          : null;

    // 6. Create TeamMatchResult entries and update the Match record
    const now = new Date();

    // 6a. Update match with result data
    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: "COMPLETED",
        winnerId: winningTeamId,
        endedAt: now,
        // Append the callback info to the log (preserve the riot code)
        log: `[callback ${now.toISOString()}] gameId=${gameId ?? "N/A"}, winner=${winningTeam ?? "N/A"}`,
      },
    });

    // 6b. Record team results
    const teamResults: Array<{
      matchId: string;
      teamId: string;
      result: TeamMatchResultEnum;
    }> = [];

    if (match.team1Id) {
      teamResults.push({
        matchId: match.id,
        teamId: match.team1Id,
        result: winningTeamId === match.team1Id ? "WON" : "LOST",
      });
    }

    if (match.team2Id) {
      teamResults.push({
        matchId: match.id,
        teamId: match.team2Id,
        result: winningTeamId === match.team2Id ? "WON" : "LOST",
      });
    }

    if (teamResults.length > 0) {
      await prisma.teamMatchResult.createMany({
        data: teamResults,
      });
    }

    console.log(
      `[RiotCallback] Processed callback for match ${match.id}: ` +
        `winner=${winningTeamId ?? "unknown"}, ` +
        `${teamResults.length} team result(s) recorded`,
    );

    // 7. Persist per-player LoL history to PlayerMatchHistory.
    //    This is best-effort: we never fail the callback for this.
    //    Only run for LoL tournaments (filter at the source).
    const tournament = match.round.tournament;
    const tournamentGame = await prisma.tournament
      .findUnique({ where: { id: tournament.id }, select: { game: true, region: true } });
    const isLOL = (tournamentGame?.game ?? "").toUpperCase() === "LEAGUE_OF_LEGENDS";
    let playersRecorded = 0;
    if (isLOL && tournamentGame?.region) {
      try {
        const region = tournamentGame.region as RiotRegion;
        // Prefer the gameId Riot gave us (numeric → convert to match-v5 id). If absent, fall
        // back to deriving from tournamentCode: in stub mode, the gameId IS the match id.
        const matchId = String(gameId ?? tournamentCode);
        const detail = await riotDataService.getMatch(matchId, region);
        if (detail) {
          // Resolve all linked users for this match by PUUID
          const puuids = detail.participants.map((p) => p.puuid).filter(Boolean);
          const linkedUsers = await prisma.user.findMany({
            where: { riotPuuid: { in: puuids } },
            select: { id: true, riotPuuid: true, riotGameName: true, riotTagLine: true },
          });
          const userByPuuid = new Map(
            linkedUsers
              .filter((u) => u.riotPuuid)
              .map((u) => [u.riotPuuid as string, u]),
          );
          for (const participant of detail.participants as MatchParticipant[]) {
            const u = userByPuuid.get(participant.puuid);
            if (!u) continue; // not linked → skip, but don't fail
            const cs = (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0);
            await recordPlayerMatch({
              userId: u.id,
              matchId,
              region,
              queueId: detail.queueId,
              gameMode: detail.gameMode,
              gameStartTimestamp: new Date(detail.gameStartTimestamp),
              gameDurationMin: Math.round(detail.gameDuration / 60),
              championId: participant.championId,
              win: !!participant.win,
              kills: participant.kills,
              deaths: participant.deaths,
              assists: participant.assists,
              cs,
              itemIds: [
                participant.item0, participant.item1, participant.item2,
                participant.item3, participant.item4, participant.item5, participant.item6,
              ],
              summoner1Perk: participant.summoner1Id,
              summoner2Perk: participant.summoner2Id,
              isTournament: true,
              tournamentId: tournament.id,
              matchGamersLandId: match.id,
              gameName: u.riotGameName,
              tagLine: u.riotTagLine,
              role: participant.teamPosition,
            });
            playersRecorded++;
          }
          console.log(
            `[RiotCallback] Recorded ${playersRecorded}/${detail.participants.length} ` +
            `PlayerMatchHistory rows for match ${match.id} (region=${region})`,
          );
        } else {
          console.warn(
            `[RiotCallback] Match-v5 detail not available for matchId=${matchId} ` +
            `— PlayerMatchHistory skipped (run a manual refresh later to backfill).`,
          );
        }
      } catch (err) {
        console.warn(
          `[RiotCallback] PlayerMatchHistory persist failed (non-fatal):`,
          err,
        );
      }
    }

    return NextResponse.json({
      success: true,
      processed: true,
      matchId: match.id,
      playersRecorded,
    });
  } catch (error) {
    console.error(`[RiotCallback] Error processing callback:`, error);
    // Always return 200 to Riot even on internal errors
    return NextResponse.json(
      { success: true, processed: false, error: "internal error" },
      { status: 200 },
    );
  }
}
