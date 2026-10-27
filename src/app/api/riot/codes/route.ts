/**
 * POST /api/riot/codes  (ADMIN u ORGANIZER)
 *
 * Genera códigos de torneo para un torneo ya registrado en Riot.
 * Cuerpo: { tournamentId, count, config: { mapType, pickType, spectatorType,
 * teamSize, allowedPUUIDs? } } — todo validado con zod.
 *
 * En modo live sin provider/torneo dados de alta responde
 * "Modo live no configurado" en vez de un error crudo de Riot.
 * Público: no — requiere sesión con rol ADMIN u ORGANIZER.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { riotService, type RiotCodeConfig } from "@/lib/riot-service";
import { isLiveMode, liveNotConfigured, riotErrorResponse } from "../_shared";

const codesSchema = z.object({
  tournamentId: z.string().trim().min(1, "Falta el identificador del torneo."),
  count: z
    .number({ message: "La cantidad debe ser un número." })
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad debe ser al menos 1.")
    .max(1000, "La cantidad puede ser como máximo 1000."),
  config: z.object({
    mapType: z.enum(["SUMMONERS_RIFT", "HOWLING_ABYSS"], {
      message: "El mapa indicado no es válido.",
    }),
    pickType: z.enum(["TOURNAMENT_DRAFT", "ALL_RANDOM", "BLIND_PICK"], {
      message: "El tipo de selección indicado no es válido.",
    }),
    spectatorType: z.enum(["NONE", "LOBBY_ONLY", "ALL"], {
      message: "El modo de espectadores indicado no es válido.",
    }),
    teamSize: z
      .number({ message: "El tamaño del equipo debe ser un número." })
      .int("El tamaño del equipo debe ser un número entero.")
      .min(1, "El tamaño del equipo debe ser al menos 1.")
      .max(5, "El tamaño del equipo puede ser como máximo 5."),
    allowedPUUIDs: z.array(z.string().trim().min(1)).max(10).optional(),
  }),
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

    const raw = await req.json().catch(() => null);
    const parsed = codesSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }
    const { tournamentId, count, config } = parsed.data;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, riotProviderId: true, riotTournamentId: true },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado." }, { status: 404 });
    }

    if (!tournament.riotProviderId || !tournament.riotTournamentId) {
      if (isLiveMode()) return liveNotConfigured();
      return NextResponse.json(
        {
          error:
            "Este torneo todavía no está registrado con Riot. Regístralo antes de generar códigos.",
        },
        { status: 400 },
      );
    }

    const codeConfig: RiotCodeConfig = {
      mapType: config.mapType,
      pickType: config.pickType,
      spectatorType: config.spectatorType,
      teamSize: config.teamSize,
      allowedPUUIDs: config.allowedPUUIDs,
    };

    const codes = await riotService.generateCodes(
      tournament.riotTournamentId,
      count,
      codeConfig,
    );

    return NextResponse.json({ success: true, codes }, { status: 201 });
  } catch (error) {
    return riotErrorResponse(error, "generar códigos");
  }
}
