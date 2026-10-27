/**
 * POST /api/profile/riot-link
 *
 * Vincula el Riot ID (gameName#tagLine) a la cuenta del usuario autenticado.
 * Resuelve PUUID con Account-v1, luego trae el summoner (level + icon) con
 * Summoner-v4, y guarda todo en la tabla User.
 *
 * Body: { riotId: "GameName#TAG", region: "la1" }
 * Respuestas:
 *   200 { ok: true, profile: { gameName, tagLine, region, puuid, summonerLevel, profileIconId } }
 *   400 { error: "..." }  (formato inválido, falta riotId)
 *   401 { error: "not authenticated" }
 *   404 { error: "Riot account not found" }
 *   503 { error: "RIOT_API_KEY not configured" }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RIOT_API_KEY_HELPER, type RiotRegion, ALL_REGIONS } from "@/lib/riot-service";
import { getAccountByRiotId, getSummonerByPuuid, parseRiotId } from "@/lib/riot-account";
import { cacheInvalidatePrefix } from "@/lib/riot-profile-cache";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  if (!RIOT_API_KEY_HELPER.get()) {
    return NextResponse.json({ error: "RIOT_API_KEY not configured" }, { status: 503 });
  }

  let body: { riotId?: string; region?: string };
  try {
    body = (await req.json()) as { riotId?: string; region?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.riotId) {
    return NextResponse.json({ error: "riotId is required (e.g. 'Faker#KR1')" }, { status: 400 });
  }
  let gameName: string, tagLine: string;
  try {
    const parsed = parseRiotId(body.riotId);
    gameName = parsed.gameName;
    tagLine = parsed.tagLine;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid riot id" }, { status: 400 });
  }

  const region = (body.region ?? "la1") as RiotRegion;
  if (!ALL_REGIONS.includes(region)) {
    return NextResponse.json({ error: `invalid region: ${region}` }, { status: 400 });
  }

  const account = await getAccountByRiotId(gameName, tagLine, region);
  if (!account) {
    return NextResponse.json(
      { error: "Cuenta de Riot no encontrada. Verifica el Riot ID y la región." },
      { status: 404 },
    );
  }

  const summoner = await getSummonerByPuuid(account.puuid, region);
  if (!summoner) {
    return NextResponse.json(
      { error: "No se pudo obtener el summoner de Riot (puede que aún no haya jugado ninguna partida en esa región)." },
      { status: 404 },
    );
  }

  // Pick a sticky random skin seed (overwrite on every link)
  const skinSeed = Math.floor(Math.random() * 1_000_000);

  // If Summoner-v4 returned the `id`, use it. Otherwise leave riotSummonerId
  // null and rely on the League-v4 /entries/by-puuid fallback in loadLoLProfile.
  const summonerIdForDb = summoner.id ?? null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      riotGameName: account.gameName,
      riotTagLine: account.tagLine,
      riotRegion: region,
      riotPuuid: account.puuid,
      riotSummonerId: summonerIdForDb,
      riotIconId: summoner.profileIconId,
      riotLinkedAt: new Date(),
      riotProfileRefreshedAt: new Date(),
      riotSkinSeed: skinSeed,
    },
  });

  // Invalidate the cached profile so the next page load re-fetches
  await cacheInvalidatePrefix(`profile:${session.user.id}:lol:`);

  return NextResponse.json({
    ok: true,
    profile: {
      gameName: account.gameName,
      tagLine: account.tagLine,
      region,
      puuid: account.puuid,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
    },
  });
}

/**
 * DELETE /api/profile/riot-link
 *
 * Desvincula la cuenta de Riot. NO borra PlayerMatchHistory — el historial
 * persiste con userId=null (onDelete: SetNull), así que el equipo puede
 * consultar el historial real aunque la cuenta se desvincula.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
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
      // Keep skinSeed — re-uses the same random pick if they re-link.
    },
  });
  await cacheInvalidatePrefix(`profile:${session.user.id}:lol:`);

  return NextResponse.json({ ok: true });
}
