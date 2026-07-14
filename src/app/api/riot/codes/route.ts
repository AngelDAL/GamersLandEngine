import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { riotService, type RiotCodeConfig } from "@/lib/riot-service";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "ORGANIZER") {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { tournamentId, count, config } = await req.json();

    if (!tournamentId || typeof tournamentId !== "string") {
      return NextResponse.json(
        { error: "tournamentId is required and must be a string" },
        { status: 400 },
      );
    }

    if (typeof count !== "number" || count < 1 || count > 1000) {
      return NextResponse.json(
        { error: "count must be a number between 1 and 1000" },
        { status: 400 },
      );
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "config is required and must be an object" },
        { status: 400 },
      );
    }

    // Look up the tournament's riot IDs
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        riotProviderId: true,
        riotTournamentId: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (!tournament.riotProviderId || !tournament.riotTournamentId) {
      return NextResponse.json(
        {
          error:
            "Tournament has not been registered with Riot yet. Call POST /api/riot/tournament first.",
        },
        { status: 400 },
      );
    }

    // Validate the config fields
    const codeConfig: RiotCodeConfig = {
      mapType: config.mapType,
      pickType: config.pickType,
      spectatorType: config.spectatorType,
      teamSize: config.teamSize,
      allowedPUUIDs: config.allowedPUUIDs,
    };

    // Generate codes
    const codes = await riotService.generateCodes(
      tournament.riotTournamentId,
      count,
      codeConfig,
    );

    return NextResponse.json({ success: true, codes }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error generating codes";
    console.error("[API] POST /api/riot/codes failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
