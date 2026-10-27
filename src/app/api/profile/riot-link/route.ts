/**
 * POST /api/profile/riot-link  (sesión requerida)
 *
 * Vincula la cuenta de League of Legends del usuario autenticado.
 * Acepta dos formas de cuerpo, ambas validadas con zod:
 *   - { gameName, tagLine, region }   (forma canónica del brief W4)
 *   - { riotId: "GameName#TAG", region } (forma que usa LoLLinkCard)
 *
 * Resuelve la cuenta con Account-v1 y el nivel/ícono con Summoner-v4,
 * persiste los campos de User y limpia la caché del perfil.
 *
 * Respuestas:
 *   200 { ok: true, profile: { gameName, tagLine, region, puuid, summonerLevel, profileIconId } }
 *   400 { error }  cuerpo inválido o región fuera de la lista permitida
 *   401 { error }  sin sesión
 *   404 { error }  Riot no conoce esa cuenta
 *   429 { error }  límite de consultas (ventana de Riot o turno de 60 s)
 *   502 { error }  Riot respondió con error
 *   503 { error }  integración sin configurar / sin conexión con Riot
 *
 * Límite propio: 1 vinculación por usuario cada 60 s (Map en memoria),
 * para no quemar la ventana de 100 req / 2 min de la clave de desarrollo.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALL_REGIONS,
  RIOT_API_KEY_HELPER,
  type RiotRegion,
} from "@/lib/riot-service";
import {
  lookupAccountByRiotId,
  lookupSummonerByPuuid,
  parseRiotId,
  type RiotLookupFailure,
} from "@/lib/riot-account";
import { takeRiotProfileActionSlot } from "@/lib/riot-profile";
import { cacheInvalidatePrefix } from "@/lib/riot-profile-cache";

export const dynamic = "force-dynamic";

const riotLinkSchema = z.object({
  gameName: z.string().trim().min(1).max(32).optional(),
  tagLine: z.string().trim().min(1).max(16).optional(),
  riotId: z.string().trim().min(3).max(64).optional(),
  region: z
    .string()
    .refine((value) => (ALL_REGIONS as readonly string[]).includes(value), {
      message: "La región seleccionada no es válida.",
    }),
});

/** Traduce el motivo de fallo de Riot a una respuesta en español. */
function failureResponse(
  failure: RiotLookupFailure,
  notFoundMessage: string,
): NextResponse {
  switch (failure) {
    case "rate-limited":
      return NextResponse.json(
        { error: "Demasiadas consultas, intenta en un minuto." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    case "not-found":
      return NextResponse.json({ error: notFoundMessage }, { status: 404 });
    case "no-key":
      return NextResponse.json(
        { error: "La integración de Riot no está configurada en el servidor." },
        { status: 503 },
      );
    case "network":
      return NextResponse.json(
        { error: "No pudimos contactar a Riot. Intenta de nuevo en unos minutos." },
        { status: 503 },
      );
    default:
      return NextResponse.json(
        { error: "Riot no respondió correctamente. Intenta de nuevo en unos minutos." },
        { status: 502 },
      );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!RIOT_API_KEY_HELPER.get()) {
    return NextResponse.json(
      { error: "La integración de Riot no está configurada en el servidor." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const parsed = riotLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  // Resuelve gameName/tagLine desde los campos sueltos o desde "GameName#TAG"
  let gameName: string | undefined;
  let tagLine: string | undefined;
  if (parsed.data.gameName && parsed.data.tagLine) {
    gameName = parsed.data.gameName;
    tagLine = parsed.data.tagLine;
  } else if (parsed.data.riotId) {
    try {
      const split = parseRiotId(parsed.data.riotId);
      gameName = split.gameName;
      tagLine = split.tagLine;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Riot ID inválido." },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "Indica tu Riot ID (nombre#etiqueta) o tu nombre y etiqueta." },
      { status: 400 },
    );
  }

  const region = parsed.data.region as RiotRegion;

  // Turno de 60 s por usuario: se toma antes de consultar Riot.
  const slot = takeRiotProfileActionSlot(session.user.id);
  if (!slot.ok) {
    return NextResponse.json(
      {
        error: "Demasiadas consultas, intenta en un minuto.",
        secondsLeft: slot.secondsLeft,
      },
      { status: 429, headers: { "Retry-After": String(slot.secondsLeft) } },
    );
  }

  const account = await lookupAccountByRiotId(gameName, tagLine, region);
  if (!account.ok) {
    return failureResponse(
      account.failure,
      "No encontramos esa cuenta con ese nombre y tag.",
    );
  }

  const summoner = await lookupSummonerByPuuid(account.value.puuid, region);
  if (!summoner.ok) {
    return failureResponse(
      summoner.failure,
      "No encontramos partidas de esa cuenta en la región seleccionada.",
    );
  }

  // Semilla fija para el arte de fondo: se renueva solo con el refresh.
  const skinSeed = Math.floor(Math.random() * 1_000_000);

  // Con Summoner-v4 a veces no viene `id` (claves de desarrollo); en ese caso
  // se deja null y loadLoLProfile usa el fallback de League-v4 por PUUID.
  const summonerIdForDb = summoner.value.id ?? null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      riotGameName: account.value.gameName,
      riotTagLine: account.value.tagLine,
      riotRegion: region,
      riotPuuid: account.value.puuid,
      riotSummonerId: summonerIdForDb,
      riotIconId: summoner.value.profileIconId,
      riotLinkedAt: new Date(),
      riotProfileRefreshedAt: new Date(),
      riotSkinSeed: skinSeed,
    },
  });

  // Vacía el perfil cacheado para que la próxima carga traiga datos nuevos
  await cacheInvalidatePrefix(`profile:${session.user.id}:lol:`);

  return NextResponse.json({
    ok: true,
    profile: {
      gameName: account.value.gameName,
      tagLine: account.value.tagLine,
      region,
      puuid: account.value.puuid,
      summonerLevel: summoner.value.summonerLevel,
      profileIconId: summoner.value.profileIconId,
    },
  });
}

/**
 * DELETE /api/profile/riot-link  (sesión requerida)
 *
 * Desvincula la cuenta de Riot. NO borra PlayerMatchHistory — el historial
 * persiste con userId=null (onDelete: SetNull), así que el perfil puede
 * conservar las partidas aunque la cuenta se desvincule.
 * No consulta Riot, por lo que no consume el turno de 60 s.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      riotGameName: null,
      riotTagLine: null,
      riotRegion: null,
      riotPuuid: null,
      riotSummonerId: null,
      riotIconId: null,
      riotLinkedAt: null,
      riotProfileRefreshedAt: null,
      // Se conserva riotSkinSeed: si vuelve a vincular, reutiliza la misma semilla.
    },
  });
  await cacheInvalidatePrefix(`profile:${session.user.id}:lol:`);

  return NextResponse.json({ ok: true });
}
