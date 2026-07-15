/**
 * LoLProfileSection — public LoL profile block for /players/[id].
 *
 * Server component: reads PlayerMatchHistory from DB (zero Riot calls on page
 * load). The splash art for the user's top champion is now rendered as a
 * fixed full-page background by the parent page — this component receives
 * the resolved splashUrl + skinName and shows them in the hero header only.
 *
 * The page is public — no auth required to see this.
 *
 * Props:
 *   - userId: the User.id whose LoL profile we show
 *   - splashSkinName?: human-readable skin name (shown next to "Main").
 *     The actual splash art URL is consumed by the parent page as a
 *     full-page background, so we don't need to render it here.
 */
import { prisma } from "@/lib/prisma";
import { loadLoLProfile, type LoLProfileData } from "@/lib/riot-profile";
import { Card } from "@/components/ui/card";
import { Trophy, Target, Swords, Crown, Award, Gift, Coins, Clock } from "lucide-react";
import Link from "next/link";

type Props = {
  userId: string;
  username: string;
  /**
   * Human-readable skin name (e.g. "Pulsefire Twisted Fate") for the top
   * champion's currently-rendered splash. The page resolves the splash art
   * itself and uses it as the full-page background; we only display the
   * skin name next to the "Main" label in the hero header.
   */
  splashSkinName?: string;
};

const RANK_COLORS: Record<string, string> = {
  IRON: "from-gray-500/20 to-gray-700/20",
  BRONZE: "from-amber-700/20 to-amber-900/20",
  SILVER: "from-slate-400/20 to-slate-600/20",
  GOLD: "from-yellow-400/20 to-yellow-600/20",
  PLATINUM: "from-cyan-300/20 to-cyan-500/20",
  EMERALD: "from-emerald-400/20 to-emerald-600/20",
  DIAMOND: "from-sky-300/20 to-sky-500/20",
  MASTER: "from-purple-500/20 to-purple-700/20",
  GRANDMASTER: "from-red-500/20 to-red-700/20",
  CHALLENGER: "from-amber-300/20 to-pink-500/20",
};

function RankedBlock({ label, entry }: { label: string; entry: NonNullable<LoLProfileData["ranked"]["solo"]> }) {
  const gradient = RANK_COLORS[entry.tier] ?? "from-gold/20 to-gold/5";
  return (
    <div className={`rounded-lg p-3 bg-gradient-to-br ${gradient} border border-border/30`}>
      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">{label}</p>
      <p className="text-lg font-bold text-gold">
        {entry.tier} {entry.rank}
      </p>
      <p className="text-xs text-muted">{entry.lp} LP · {entry.wins}W {entry.losses}L · {entry.winrate}%</p>
    </div>
  );
}

export async function LoLProfileSection({ userId, username, splashSkinName }: Props) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { riotGameName: true, riotTagLine: true, riotRegion: true, riotPuuid: true },
  });
  if (!user?.riotPuuid || !user.riotGameName || !user.riotTagLine) {
    return (
      <Card className="p-6 text-center">
        <Swords className="w-10 h-10 mx-auto mb-3 text-muted opacity-30" />
        <p className="text-sm text-muted">
          {username} aún no ha vinculado su cuenta de League of Legends.
        </p>
        <p className="text-xs text-muted/70 mt-1">
          Puede hacerlo desde su panel en <Link href="/dashboard/player" className="text-gold hover:underline">/dashboard/player</Link>.
        </p>
      </Card>
    );
  }

  const profile = await loadLoLProfile(userId);
  if (!profile) {
    return (
      <Card className="p-6 text-center">
        <Swords className="w-10 h-10 mx-auto mb-3 text-muted opacity-30" />
        <p className="text-sm text-muted">
          {username} no tiene partidas de LoL todavía.
        </p>
      </Card>
    );
  }

  // Splash art for the top champion is resolved by the parent page so it
  // can be used as a full-page background. We only need topChampions[0]
  // here for the "Main" label in the hero header.

  return (
    <div className="space-y-4">
      {/* Hero card. The full-page background is rendered by the parent page;
          this card sits above it with a dark glass surface so the text stays
          legible regardless of the splash art behind it. */}
      <Card className="relative overflow-hidden p-0 border-gold/20 bg-background/70 backdrop-blur-md">
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              {/* Profile icon (DDragon) with letter-avatar fallback. Uses a CSS
                  background-image so a missing/failed icon silently falls
                  through to the first-letter div underneath — no JS needed. */}
              {profile.profileIconUrl ? (
                <div
                  className="relative w-16 h-16 shrink-0 rounded-full border-2 border-gold/60 shadow-lg bg-cover bg-center bg-surface"
                  style={{ backgroundImage: `url(${profile.profileIconUrl})` }}
                  role="img"
                  aria-label={`Icono de invocador de ${profile.gameName}`}
                >
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center text-xl font-bold text-gold"
                    aria-hidden="true"
                  >
                    {profile.gameName.charAt(0).toUpperCase() || "?"}
                  </div>
                </div>
              ) : (
                <div
                  className="w-16 h-16 shrink-0 rounded-full border-2 border-gold/60 shadow-lg bg-surface flex items-center justify-center text-xl font-bold text-gold"
                  aria-hidden="true"
                >
                  {profile.gameName.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">League of Legends</p>
                <h2
                  className="text-2xl font-bold text-white truncate"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
                >
                  {profile.gameName}#{profile.tagLine}
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  Región {profile.region.toUpperCase()} · Nivel {profile.summonerLevel}
                </p>
              </div>
            </div>
            {splashSkinName && profile.topChampions[0] && (
              <div className="text-right shrink-0">
                <p className="text-[10px] text-white/70 uppercase tracking-wider">Main</p>
                <p className="text-sm font-bold text-gold">{profile.topChampions[0].name}</p>
                <p className="text-[10px] text-white/60">{splashSkinName}</p>
              </div>
            )}
          </div>

          {/* Aggregate stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="rounded bg-background/60 backdrop-blur-sm p-2 border border-border/30">
              <p className="text-[9px] text-muted uppercase">Partidas</p>
              <p className="text-base font-bold">{profile.aggregate.total}</p>
            </div>
            <div className="rounded bg-background/60 backdrop-blur-sm p-2 border border-border/30">
              <p className="text-[9px] text-muted uppercase">WR</p>
              <p className="text-base font-bold text-gold">{profile.aggregate.winrate}%</p>
            </div>
            <div className="rounded bg-background/60 backdrop-blur-sm p-2 border border-border/30">
              <p className="text-[9px] text-muted uppercase">KDA</p>
              <p className="text-base font-bold">{profile.aggregate.avgKda.toFixed(2)}</p>
            </div>
            <div className="rounded bg-background/60 backdrop-blur-sm p-2 border border-border/30">
              <p className="text-[9px] text-muted uppercase">Torneo</p>
              <p className="text-base font-bold text-amber-400">
                {profile.aggregate.tournamentWins}-{profile.aggregate.tournamentLosses}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Ranked + Top 5 mastery */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4" /> Rango
          </h3>
          {(profile.ranked.solo || profile.ranked.flex) ? (
            <div className="space-y-2">
              {profile.ranked.solo && <RankedBlock label="Solo / Duo" entry={profile.ranked.solo} />}
              {profile.ranked.flex && <RankedBlock label="Flex 5v5" entry={profile.ranked.flex} />}
            </div>
          ) : (
            <p className="text-xs text-muted">Sin clasificación esta temporada.</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4" /> Top 5 Campeones
          </h3>
          {profile.topChampions.length === 0 ? (
            <p className="text-xs text-muted">Sin datos de mastery.</p>
          ) : (
            <div className="space-y-2">
              {profile.topChampions.map((c) => {
                const isCappedLevel = c.level >= 5; // 5–7: no progress to next level
                const total = c.pointsSinceLastLevel + c.pointsUntilNextLevel;
                const pct = !isCappedLevel && total > 0
                  ? Math.min(100, Math.round((c.pointsSinceLastLevel / total) * 100))
                  : 100;
                return (
                  <div key={c.championId} className="flex items-start gap-3">
                    {c.iconUrl ? (
                      <img src={c.iconUrl} alt={c.name} className="w-8 h-8 rounded border border-border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-surface shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <span
                          className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                            c.chestGranted
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                          }`}
                          title={c.chestGranted ? "Cofre ya obtenido esta temporada" : "Cofre aún no obtenido"}
                        >
                          <Gift className="w-3 h-3" />
                          {c.chestGranted ? "Cofre ✓" : "Sin cofre"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">
                        Nivel {c.level} · {c.points.toLocaleString()} pts
                        {c.tokensEarned > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-amber-300">
                            <Coins className="w-3 h-3" /> {c.tokensEarned}
                          </span>
                        )}
                        {c.lastPlayTime > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> {formatTimeAgo(c.lastPlayTime)}
                          </span>
                        )}
                      </p>
                      {!isCappedLevel && total > 0 ? (
                        <div>
                          <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-gold to-amber-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-muted mt-0.5">
                            {c.pointsSinceLastLevel.toLocaleString()} / {total.toLocaleString()} pts al siguiente nivel
                          </p>
                        </div>
                      ) : (
                        <p className="text-[9px] text-muted">Nivel máximo</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent matches with 🏆 badge for tournament games */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4" /> Últimas 20 partidas
          <span className="text-[10px] text-muted ml-auto">de todas las colas</span>
        </h3>
        {profile.recentMatches.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">Sin partidas registradas todavía.</p>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {profile.recentMatches.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 py-2 px-2 rounded border ${
                  m.win
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/10 bg-red-500/5"
                }`}
              >
                {m.championIconUrl ? (
                  <img src={m.championIconUrl} alt={m.championName} className="w-9 h-9 rounded border border-border shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded bg-surface shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{m.championName}</p>
                    {m.isTournament && (
                      <span
                        title="Partida de torneo GamersLand"
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold inline-flex items-center gap-1 shrink-0"
                      >
                        <Trophy className="w-2.5 h-2.5" /> Torneo
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted">
                    {m.queueName} · {Math.round(m.gameDurationMin)}m ·{" "}
                    {new Date(m.gameStartTimestamp).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold">
                    <span className={m.win ? "text-green-400" : "text-red-400"}>
                      {m.kills}/{m.deaths}/{m.assists}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted">CS {m.cs}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Compact Spanish "time ago" formatter for a Riot epoch-ms timestamp.
 * Mirrors the granularity of Intl.RelativeTimeFormat without pulling the
 * polyfill. Returns "—" for 0 / future timestamps.
 */
function formatTimeAgo(epochMs: number): string {
  if (!epochMs || epochMs > Date.now()) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `hace ${diffD}d`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `hace ${diffMo}mes`;
  return `hace ${Math.floor(diffMo / 12)}a`;
}
