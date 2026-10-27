/**
 * POST /api/profile/riot-refresh  (sesión requerida)
 *
 * Refresca el perfil LoL del usuario con la capa de caché:
 *
 *  - Si el caché del perfil está vivo (TTL de 1 h) NO se hace ninguna
 *    petición real a Riot: se devuelve el caché y solo se rota la semilla
 *    del arte de fondo. Así el botón nunca quema la ventana de 100 req/2 min.
 *  - Si el caché expiró, se limpia y se vuelve a cargar (rango, mastery e
 *    invocador), y de paso se rellena el historial si tiene menos de 20
 *    partidas guardadas.
 *
 * Límite propio: 1 link/refresh por usuario cada 60 s (Map en memoria,
 * compartido con /api/profile/riot-link).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  loadLoLProfile,
  getRandomSplashForTopChampion,
  takeRiotProfileActionSlot,
  type LoLProfileData,
} from "@/lib/riot-profile";
import { cacheGet, cacheInvalidate } from "@/lib/riot-profile-cache";

export const dynamic = "force-dynamic";

const PROFILE_CACHE_KEY = "profile:{userId}:lol:v3";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { riotPuuid: true, riotSkinSeed: true },
  });
  if (!user?.riotPuuid) {
    return NextResponse.json(
      { error: "Primero vincula tu cuenta de League of Legends." },
      { status: 400 },
    );
  }

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

  const cacheKey = PROFILE_CACHE_KEY.replace("{userId}", session.user.id);
  const cached = await cacheGet<LoLProfileData>(cacheKey);

  // Rotación de la semilla: elige otro splash del campeón principal.
  const newSeed = Math.floor(Math.random() * 1_000_000);

  let profile: LoLProfileData | null;
  if (cached) {
    // Caché vivo: 0 peticiones reales a Riot.
    profile = { ...cached, fromCache: true, cachedAt: Date.now() };
  } else {
    // Caché expirado: recarga real (rango + mastery + invocador) y, si tiene
    // menos de 20 partidas guardadas, rellena el historial desde Match-v5.
    await cacheInvalidate(`user:${session.user.id}:mastery`);
    profile = await loadLoLProfile(session.user.id, {
      skipCache: true,
      topUpFromRiot: true,
    });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { riotProfileRefreshedAt: new Date(), riotSkinSeed: newSeed },
  });

  if (profile?.profileIconId) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { riotIconId: profile.profileIconId },
    });
  }

  // El splash sale de CommunityDragon (CDN, no cuenta para el presupuesto)
  let splash: { url: string; skinName: string; skinNum: number } | null = null;
  if (profile && profile.topChampions[0]) {
    splash = await getRandomSplashForTopChampion(
      profile.topChampions[0].championId,
      newSeed,
    );
  }

  return NextResponse.json({
    ok: true,
    profile,
    splash,
    refreshedAt: new Date().toISOString(),
  });
}
