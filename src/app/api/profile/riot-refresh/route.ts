/**
 * POST /api/profile/riot-refresh
 *
 * Refresca la caché del perfil LoL del usuario (ranked, mastery, matches).
 * Cooldown: 5 min entre refreshes (límite: 12 fetches/hora/usuario).
 * El botón "Refrescar" del dashboard usa este endpoint.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLoLProfile, getRandomSplashForTopChampion } from "@/lib/riot-profile";
import { cacheInvalidate } from "@/lib/riot-profile-cache";

export const dynamic = "force-dynamic";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 min

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { riotPuuid: true, riotProfileRefreshedAt: true, riotSkinSeed: true },
  });
  if (!user?.riotPuuid) {
    return NextResponse.json(
      { error: "Riot account not linked. POST /api/profile/riot-link first." },
      { status: 400 },
    );
  }

  if (user.riotProfileRefreshedAt) {
    const elapsed = Date.now() - user.riotProfileRefreshedAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const secondsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: "Cooldown activo. Espera un momento antes de refrescar de nuevo.",
          cooldownSecondsLeft: secondsLeft,
        },
        { status: 429 },
      );
    }
  }

  // Invalidate caches, refresh DB-blessed timestamp, then reload.
  await cacheInvalidate(`profile:${session.user.id}:lol:v3`);
  await cacheInvalidate(`user:${session.user.id}:mastery`);

  // Re-seed skin pick on refresh (rotates the splash art)
  const newSeed = Math.floor(Math.random() * 1_000_000);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { riotProfileRefreshedAt: new Date(), riotSkinSeed: newSeed },
  });

  const profile = await loadLoLProfile(session.user.id, { skipCache: true, topUpFromRiot: true });

  // Update the sticky iconId in case Riot rotated it
  if (profile?.profileIconId) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { riotIconId: profile.profileIconId },
    });
  }

  // Resolve the new splash art (top mastery champ × new seed)
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
    refreshCount: "1 (max 12 per hour)",
  });
}
