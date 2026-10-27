/**
 * POST /api/riot/tournament  (ADMIN u ORGANIZER)
 *
 * Crea el torneo en Riot bajo un provider ya registrado y guarda los IDs
 * en la fila del torneo. Cuerpo: { tournamentId, providerId?, name? }
 *
 * En modo live, si el torneo todavía no tiene provider, se responde
 * "Modo live no configurado" en lugar de un error crudo de Riot.
 * Público: no — requiere sesión con rol ADMIN u ORGANIZER.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { riotService } from "@/lib/riot-service";
import { isLiveMode, liveNotConfigured, riotErrorResponse } from "../_shared";

const tournamentSchema = z.object({
  tournamentId: z.string().trim().min(1, "Falta el identificador del torneo."),
  providerId: z
    .number({ message: "El provider debe ser un número." })
    .int("El provider debe ser un número entero.")
    .positive("El provider debe ser un número entero.")
    .optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

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

    const raw = await req.json().catch(() => ({}));
    const parsed = tournamentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }
    const { tournamentId, providerId: explicitProviderId, name } = parsed.data;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado." }, { status: 404 });
    }

    // Provider: el explícito > el guardado. Sin ninguno, en live no se finge.
    const providerId = explicitProviderId ?? tournament.riotProviderId ?? null;
    if (!providerId) {
      if (isLiveMode()) return liveNotConfigured();
      return NextResponse.json(
        {
          error:
            "Este torneo todavía no tiene provider en Riot. Regístralo primero (POST /api/riot/provider).",
        },
        { status: 400 },
      );
    }

    const riotTournamentId = await riotService.createTournament(
      providerId,
      name ?? tournament.name,
    );

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { riotProviderId: providerId, riotTournamentId },
    });

    return NextResponse.json(
      { success: true, riotTournamentId, providerId },
      { status: 201 },
    );
  } catch (error) {
    return riotErrorResponse(error, "crear torneo");
  }
}
