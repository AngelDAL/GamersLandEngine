/**
 * POST /api/riot/provider  (ADMIN u ORGANIZER)
 *
 * Registra un provider ante Riot: es el primer paso externo de la
 * integración y solo hace falta una vez por plataforma. El server rellena
 * región y callback por defecto; el cuerpo es opcional.
 *
 * Body opcional: { region?: string, callbackUrl?: string }
 * Público: no — requiere sesión con rol ADMIN u ORGANIZER.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { riotService, RIOT_CALLBACK_URL } from "@/lib/riot-service";
import { riotErrorResponse } from "../_shared";

const DEFAULT_REGION = "LAN";

const providerSchema = z.object({
  region: z
    .string()
    .trim()
    .min(2, "La región no es válida.")
    .max(16, "La región no es válida.")
    .optional(),
  callbackUrl: z
    .string()
    .trim()
    .url("La URL de retorno no es válida.")
    .optional(),
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
    const parsed = providerSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }

    const region = (parsed.data.region ?? DEFAULT_REGION).toUpperCase();
    const callbackUrl = parsed.data.callbackUrl ?? RIOT_CALLBACK_URL;

    const providerId = await riotService.createProvider(region, callbackUrl);

    return NextResponse.json(
      { success: true, providerId, region, callbackUrl },
      { status: 201 },
    );
  } catch (error) {
    return riotErrorResponse(error, "crear provider");
  }
}
