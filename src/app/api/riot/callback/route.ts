import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TeamMatchResultEnum } from "@/generated/prisma/enums";

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

    // 4. Find the match associated with this tournament code
    //    The match's `log` field is used as a convention to store the
    //    Riot tournament code that was assigned when generating codes.
    const match = await prisma.match.findFirst({
      where: { log: tournamentCode },
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
        // Append the callback info to the log
        log: `${match.log ?? ""}\n[callback ${now.toISOString()}] gameId=${gameId ?? "N/A"}, winner=${winningTeam ?? "N/A"}`,
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

    return NextResponse.json({
      success: true,
      processed: true,
      matchId: match.id,
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
