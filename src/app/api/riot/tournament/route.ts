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

    const body = await req.json().catch(() => ({}));
    const tournamentId: string | undefined = body?.tournamentId;
    const explicitProviderId: number | undefined =
      typeof body?.providerId === "number" ? body.providerId : undefined;

    if (!tournamentId || typeof tournamentId !== "string") {
      return NextResponse.json(
        { error: "tournamentId is required and must be a string" },
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

    // Resolve provider: explicit > stored > error
    let providerId = explicitProviderId ?? tournament.riotProviderId ?? null;
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider not registered. Call /api/riot/provider first." },
        { status: 400 },
      );
    }

    // Create the Riot tournament
    const tournamentName = body?.name ?? tournament.name;
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
      { success: true, riotTournamentId, providerId },
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
