import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoLProfileSection } from "@/components/player/LoLProfileSection";
import { loadLoLProfile, getRandomSplashForTopChampion } from "@/lib/riot-profile";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      riotPuuid: true,
      riotSkinSeed: true,
      registrations: {
        include: {
          tournament: { select: { id: true, name: true, game: true, status: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      matchResults: {
        include: {
          match: {
            include: {
              round: {
                include: { tournament: { select: { id: true, name: true, game: true } } },
              },

            },
          },
        },
        orderBy: { match: { round: { roundNumber: "desc" } } },
        take: 20,
      },
      claimedPrizes: {
        include: {
          prize: { include: { tournament: { select: { name: true } } } },
          clerk: { select: { username: true } },
        },
        orderBy: { claimedAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const isOwner = session?.user?.id === user.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const canSeePrivate = isOwner || isAdmin;

  // Privacy: friends/logged-out visitors only see WON matches; owners and admins see everything.
  const visibleMatchResults = canSeePrivate
    ? user.matchResults
    : user.matchResults.filter((r) => r.result === "WON");

  const wins = visibleMatchResults.filter((r) => r.result === "WON").length;
  const total = visibleMatchResults.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Resolve the splash art for the user's top mastery champion so we can
  // use it as a full-page background. Mirrors the previous hero-card
  // Resolve the splash art for the user's top mastery champion so we can
  // use it as a full-page background. As of 2026-07-16 we source the art
  // from CommunityDragon (raw.communitydragon.org) instead of DDragon —
  // DDragon's /img/splash/ paths started returning 403 on 2026-07-15,
  // while CDragon's `latest/plugins/rcp-be-lol-game-data/...` path is
  // still serving and has CORS open (`access-control-allow-origin: *`).
  // URL is built via buildCommunityDragonSplashUrl() inside riot-profile.
  let splashUrl: string | undefined;
  let splashSkinName: string | undefined;
  if (user.riotPuuid) {
    const lolProfile = await loadLoLProfile(user.id);
    const top = lolProfile?.topChampions?.[0];
    if (top) {
      // Random skin on every page load (no persistent seed) — each visit
      // to a profile shows a different splash art of the user's main
      // champion, giving the profile a "wallpaper of the day" feel.
      // The pool is still bound by the chroma resolver so the URL always
      // points at a skin that actually exists on CommunityDragon.
      const splash = await getRandomSplashForTopChampion(
        top.championId,
        Math.floor(Math.random() * 1e9),
      );
      if (splash) {
        splashUrl = splash.url;
        splashSkinName = splash.skinName;
      }
    }
  }

  return (
    <div className="relative">
      {/* Full-page splash background. Positioned fixed so it stays put
          during scroll and behind all page content. A dark overlay keeps
          text legible regardless of the splash's brightness. We only
          render this when the user has a top champion with a resolvable
          splash — otherwise the page falls back to the default surface. */}
      {/*
        Page-level splash background. Sourced from CommunityDragon
        (raw.communitydragon.org) — see src/lib/riot-profile.ts for the
        URL builder. DDragon /img/splash/ has been 403 since 2026-07-15.
        The gold/dark gradient overlay + bottom fade are ALWAYS rendered
        (below) and carry the visual weight of the background even if
        the splash art 404s for chromas or new skins.
      */}
      {splashUrl ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${splashUrl})`, opacity: 0.25 }}
        />
      ) : null}
      {/* Subtle colored gradient overlay: adds a tonal accent (brand gold
          mixed with the dark background). Always rendered — it carries the
          visual weight of the background. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0A0E1A]/0 via-[#C8AA6E]/5 to-[#0A0E1A]/30 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 h-2/5 -z-10 bg-gradient-to-b from-transparent via-background/40 to-background pointer-events-none"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
      {!canSeePrivate && (
        <div className="text-xs text-muted/70 border-b border-border/30 py-2 mb-4 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          <span>Estás viendo el perfil público de {user.username}.</span>
        </div>
      )}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center text-gold text-2xl font-bold">
          {user.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gold">{user.username}</h1>
          <Badge variant={user.role === "PLAYER" ? "green" : "gold"}>{user.role}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card><p className="text-muted text-sm">Partidas</p><p className="text-2xl font-bold">{total}</p></Card>
        <Card><p className="text-muted text-sm">Victorias</p><p className="text-2xl font-bold text-green">{wins}</p></Card>
        <Card><p className="text-muted text-sm">Win Rate</p><p className="text-2xl font-bold text-gold">{winRate}%</p></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-gold mb-4">Historial de Partidas</h2>
          {visibleMatchResults.length === 0 ? (
            <p className="text-muted text-sm">Sin partidas registradas</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {visibleMatchResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.match.round.tournament.name}</p>
                    <p className="text-xs text-muted">Partida #{r.match.bracketPosition !== null ? r.match.bracketPosition + 1 : "?"}</p>
                  </div>
                  <Badge variant={r.result === "WON" ? "green" : r.result === "LOST" ? "red" : "default"}>
                    {r.result}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {canSeePrivate && (
          <Card>
            <h2 className="text-lg font-bold text-gold mb-4">Premios Reclamados</h2>
            {user.claimedPrizes.length === 0 ? (
              <p className="text-muted text-sm">Sin premios reclamados</p>
            ) : (
              <div className="space-y-2">
                {user.claimedPrizes.map((c) => (
                  <div key={c.id} className="py-2 border-b border-border last:border-0">
                    <p className="text-sm font-medium">{c.prize.name}</p>
                    <p className="text-xs text-muted">
                      {c.prize.tournament.name} — {c.prize.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* LoL Profile — public, server-rendered, DB-backed. Zero Riot calls on page load. */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gold mb-4">Perfil de League of Legends</h2>
        <LoLProfileSection
          userId={user.id}
          username={user.username}
          splashSkinName={splashSkinName}
        />
      </div>
    </div>
    </div>
  );
}
