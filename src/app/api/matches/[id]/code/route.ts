import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMatchCode } from "@/lib/riot-integration";

/**
 * GET /api/matches/[id]/code
 *
 * Returns the Riot tournament code for a specific match.
 *
 * Authorization rules:
 * - Admin/Organizer: can see the code for ANY match in their tournaments.
 * - Team captain/member of one of the two teams in the match: can see their code.
 * - Anyone else: 403.
 *
 * The code is auto-generated the first time it's requested (or pre-generated
 * by the system). Once issued, the same code is returned on subsequent calls.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matchId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;
  const isOrganizer = session.user.role === "ADMIN" || session.user.role === "ORGANIZER";

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      riotCode: true,
      status: true,
      round: {
        select: {
          tournamentId: true,
          tournament: { select: { game: true } },
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });
  }

  // Only LoL matches have codes
  if ((match.round.tournament.game ?? "").toUpperCase() !== "LEAGUE_OF_LEGENDS") {
    return NextResponse.json(
      { error: "Este partido no usa códigos de Riot" },
      { status: 400 },
    );
  }

  // Authorization: organizer OR team member of one of the two teams
  if (!isOrganizer) {
    const memberships = await prisma.teamMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        teamId: { in: [match.team1Id, match.team2Id].filter((t): t is string => !!t) },
      },
      select: { teamId: true },
    });
    if (memberships.length === 0) {
      return NextResponse.json(
        { error: "No tienes acceso a este código" },
        { status: 403 },
      );
    }
  }

  // Lazy-generate the code if missing (covers cases where the admin requests
  // a code for a match that wasn't pre-generated when the bracket was created).
  let code = match.riotCode;
  if (!code) {
    try {
      code = await generateMatchCode(matchId);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `No se pudo generar el código: ${err.message}`
              : "No se pudo generar el código",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ code });
}
