import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TeamMatchResultEnum } from "@/generated/prisma/enums";
import { riotDataService, type MatchParticipant } from "@/lib/riot-data";
import { recordPlayerMatch } from "@/lib/riot-profile";
import type { RiotRegion } from "@/lib/riot-service";

// ─── Payload ─────────────────────────────────────────────────────────────────

/**
 * Riot can send game result payloads in different shapes:
 *
 * **Stub API** (testing) — camelCase:
 * `{ tournamentCode, gameId, participants, winningTeam }`
 *
 * **Production API** — puede venir en snake_case:
 * `{ tournament_code, game_id, winning_team }`
 *
 * El esquema acepta ambas grafías; los demás campos que manda Riot se
 * ignoran (el detalle de la partida se pide a Match-v5 cuando aplica).
 */
const callbackSchema = z.object({
  tournamentCode: z.string().trim().min(1).optional(),
  tournament_code: z.string().trim().min(1).optional(),
  gameId: z.union([z.string().trim().min(1), z.number()]).optional(),
  game_id: z.union([z.string().trim().min(1), z.number()]).optional(),
  winningTeam: z.number().optional(),
  winning_team: z.number().optional(),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * POST /api/riot/callback  — ENDPOINT PÚBLICO (sin sesión).
 *
 * Webhook al que Riot avisa cuando termina una partida de torneo. Es
 * server-to-server: no lleva auth porque Riot no puede iniciar sesión aquí.
 * Siempre responde 200 para que Riot no reintente en bucle.
 *
 * Acepta las formas stub y production, valida el cuerpo con zod y deja el
 * resultado en la base (partido + resultados de equipo + historial cuando
 * el torneo está en modo live).
 */
export async function POST(request: Request) {
  try {
    // 1. Parse and validate the incoming payload
    const raw: unknown = await request.json();
    const parsed = callbackSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, processed: false, error: "Cuerpo del callback inválido." },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // 2. Log the callback for debugging (truncate to avoid flooding logs)
    console.log(`[RiotCallback] Received callback: ${JSON.stringify(raw).slice(0, 500)}`);

    // 3. Normalise field names (Stub vs Production API)
    const tournamentCode = body.tournamentCode ?? body.tournament_code;
    const gameId = body.gameId ?? body.game_id;
    const winningTeam = body.winningTeam ?? body.winning_team;

    if (!tournamentCode) {
      console.warn(`[RiotCallback] Missing tournamentCode in callback payload`);
      return NextResponse.json({
        success: true,
        processed: false,
        reason: "falta tournamentCode",
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

    // 5. Determine which team won.
    //    Riot uses team IDs 100 (blue) and 200 (red). En nuestro Match,
    //    team1Id/team2Id ocupan esos dos lados. Si el payload no trae un
    //    ganador reconocible NO se toca el partido: mejor sin resultado que
    //    un resultado inventado.
    if (winningTeam !== 100 && winningTeam !== 200) {
      console.warn(
        `[RiotCallback] winningTeam no reconocido (${String(winningTeam)}) para el código ${tournamentCode} — no se modifica el partido`,
      );
      return NextResponse.json({
        success: true,
        processed: false,
        reason: "winningTeam no reconocido",
      });
    }

    const winningTeamId = winningTeam === 100 ? match.team1Id : match.team2Id;

    // 6. Update the Match record + team results in one transaction, and
    //    reemplaza los resultados previos: Riot puede reenviar el callback
    //    y no queremos filas duplicadas.
    const now = new Date();

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

    await prisma.$transaction([
      prisma.match.update({
        where: { id: match.id },
        data: {
          status: "COMPLETED",
          winnerId: winningTeamId,
          endedAt: now,
          // Se conserva el código de Riot; solo se anota el resultado.
          log: `[callback ${now.toISOString()}] gameId=${gameId ?? "N/A"}, winner=${winningTeam}`,
        },
      }),
      prisma.teamMatchResult.deleteMany({ where: { matchId: match.id } }),
      ...(teamResults.length > 0
        ? [prisma.teamMatchResult.createMany({ data: teamResults })]
        : []),
    ]);

    console.log(
      `[RiotCallback] Processed callback for match ${match.id}: ` +
        `winner=${winningTeamId ?? "unknown"}, ` +
        `${teamResults.length} team result(s) recorded`,
    );

    // 7. Persist per-player LoL history to PlayerMatchHistory.
    //    Solo en modo live: en stub no existen esas partidas en Match-v5 y la
    //    consulta fallida solo gastaría peticiones de la ventana de Riot.
    //    Es best-effort: nunca hace fallar al callback.
    const tournament = match.round.tournament;
    let playersRecorded = 0;
    if (tournament.riotMode === "production") {
      const tournamentGame = await prisma.tournament
        .findUnique({ where: { id: tournament.id }, select: { game: true, region: true } });
      const isLOL = (tournamentGame?.game ?? "").toUpperCase() === "LEAGUE_OF_LEGENDS";
      if (isLOL && tournamentGame?.region) {
        try {
          const region = tournamentGame.region as RiotRegion;
          // Preferimos el gameId que manda Riot; si no viene, usamos el código.
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
      { success: true, processed: false, error: "Error interno al procesar el callback." },
      { status: 200 },
    );
  }
}
