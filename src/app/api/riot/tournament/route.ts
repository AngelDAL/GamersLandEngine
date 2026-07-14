import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { riotService } from "@/lib/riot-service";

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

    const { tournamentId, providerId, name } = await req.json();

    if (!tournamentId || typeof tournamentId !== "string") {
      return NextResponse.json(
        { error: "tournamentId is required and must be a string" },
        { status: 400 },
      );
    }

    if (typeof providerId !== "number" || providerId <= 0) {
      return NextResponse.json(
        { error: "providerId is required and must be a positive number" },
        { status: 400 },
      );
    }

    // Verify the tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Create the Riot tournament
    const tournamentName = name ?? tournament.name;
    const riotTournamentId = await riotService.createTournament(
      providerId,
      tournamentName,
    );

    // Update the DB tournament with Riot IDs
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        riotProviderId: providerId,
        riotTournamentId: riotTournamentId,
      },
    });

    return NextResponse.json(
      { success: true, riotTournamentId },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error creating tournament";
    console.error("[API] POST /api/riot/tournament failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
