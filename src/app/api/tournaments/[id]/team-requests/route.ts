import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { loadLoLProfile } from "@/lib/riot-profile";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: tournamentId } = await params;

  // Get all teams registered in this tournament
  const tournamentTeams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: { teamId: true },
  });
  const teamIds = tournamentTeams.map((tt) => tt.teamId);

  if (teamIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get PENDING members (join requests) for these teams
  const pendingMembers = await prisma.teamMember.findMany({
    where: {
      teamId: { in: teamIds },
      status: "PENDING",
    },
    select: {
      id: true,
      userId: true,
      teamId: true,
      status: true,
      message: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          riotGameName: true,
          riotTagLine: true,
          riotRegion: true,
          riotPuuid: true,
          riotIconId: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          captain: { select: { id: true, username: true } },
        },
      },
    },
  });

  // Enrich with LoL profiles (async, best-effort)
  const enriched = await Promise.all(
    pendingMembers.map(async (member) => {
      let lolProfile = null;
      if (member.user.riotPuuid) {
        try {
          lolProfile = await loadLoLProfile(member.user.id, { skipCache: false });
        } catch {
          // Silently fail — show what we have from DB
        }
      }

      return {
        id: member.id,
        userId: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
        message: member.message,
        team: {
          id: member.team.id,
          name: member.team.name,
          captain: member.team.captain,
        },
        lolProfile: lolProfile
          ? {
              gameName: lolProfile.gameName,
              tagLine: lolProfile.tagLine,
              profileIconId: lolProfile.profileIconId,
              summonerLevel: lolProfile.summonerLevel,
              soloRank: lolProfile.ranked?.solo
                ? {
                    tier: lolProfile.ranked.solo.tier,
                    rank: lolProfile.ranked.solo.rank,
                    lp: lolProfile.ranked.solo.lp,
                    wins: lolProfile.ranked.solo.wins,
                    losses: lolProfile.ranked.solo.losses,
                  }
                : null,
              flexRank: lolProfile.ranked?.flex
                ? {
                    tier: lolProfile.ranked.flex.tier,
                    rank: lolProfile.ranked.flex.rank,
                    lp: lolProfile.ranked.flex.lp,
                    wins: lolProfile.ranked.flex.wins,
                    losses: lolProfile.ranked.flex.losses,
                  }
                : null,
              topChampions: (lolProfile.topChampions || []).slice(0, 3).map((c) => ({
                championId: c.championId,
                name: c.name,
                level: c.level,
                points: c.points,
              })),
            }
          : null,
      };
    })
  );

  return NextResponse.json(enriched);
}
