import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ManageTournamentClient } from "./ManageTournamentClient";

export const dynamic = "force-dynamic";

export default async function ManageTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organizers: { include: { user: { select: { id: true, username: true } } } },
      prizes: { orderBy: { position: "asc" } },
      rounds: {
        include: {
          matches: {
            include: {
              winner: { select: { id: true, name: true } },
            },
            orderBy: { bracketPosition: "asc" },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      tournamentTeams: {
        include: {
          team: {
            include: {
              members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, username: true } } } },
              captain: { select: { id: true, username: true } },
            },
          },
        },
      },
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) notFound();

  // Get ALL players in the system (for search)
  const allPlayers = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { id: true, username: true, role: true, avatarUrl: true },
    orderBy: { username: "asc" },
  });

  // Get registered users for this tournament
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: id },
    include: { user: { select: { id: true, username: true, role: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  const players = registrations.map((r) => r.user);
  const registeredUserIds = new Set(players.map((p) => p.id));

  const [orgUsers, teams] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ORGANIZER", "ADMIN"] } },
      select: { id: true, username: true, role: true },
      orderBy: { username: "asc" },
    }),
    prisma.team.findMany({
      include: {
        captain: { select: { id: true, username: true } },
        members: {
          where: { status: "ACTIVE" },
          include: { user: { select: { id: true, username: true } } },
        },
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    }).then((ts) =>
      ts.map((t) => ({
        ...t,
        members: t.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          status: m.status,
          user: m.user,
        })),
      }))
    ),
  ]);

  // Free agents: registered players NOT in any team
  const membersInTeam = new Set(teams.flatMap((t: any) => t.members.map((m: any) => m.userId)));
  const freeAgents = players.filter((p) => !membersInTeam.has(p.id));

  // Serialize tournament to plain object (fix Decimal error)
  const serialized = {
    ...tournament,
    entryFee: tournament.entryFee ? Number(tournament.entryFee) : null,
    eventDate: tournament.eventDate.toISOString(),
    registrationDeadline: tournament.registrationDeadline?.toISOString() || null,
    createdAt: tournament.createdAt.toISOString(),
    tournamentTeams: tournament.tournamentTeams.map((tt) => ({
      id: tt.id,
      teamId: tt.teamId,
      seed: tt.seed,
      team: {
        id: tt.team.id,
        name: tt.team.name,
        captainId: tt.team.captainId,
        captain: tt.team.captain,
        _count: { members: tt.team.members.filter((m: any) => m.status === "ACTIVE").length },
        members: tt.team.members.map((m: any) => ({
          userId: m.userId,
          status: m.status,
          user: m.user,
        })),
      },
    })),
  };

  const gameLabel = tournament.game?.replace(/_/g, " ") || "Torneo";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Banner compacto */}
      {tournament.imageUrl && (
        <div className="relative h-24 rounded-xl overflow-hidden mb-6">
          <img src={tournament.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gold">{tournament.name}</h1>
          <p className="text-sm text-muted mt-1">
            {gameLabel} — {tournament.status}
          </p>
        </div>
        <Link href={`/tournaments/${id}`} className="text-sm text-muted hover:text-foreground">
          ← Ver público
        </Link>
      </div>

      <ManageTournamentClient
        tournament={serialized}
        players={players}
        registrations={registrations.map(r => ({
          id: r.id,
          userId: r.userId,
          paid: r.paid,
          checkedInAt: r.checkedInAt ? r.checkedInAt.toISOString() : null,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          user: { id: r.user.id, username: r.user.username, avatarUrl: r.user.avatarUrl },
        }))}
        allPlayers={allPlayers}
        organizers={orgUsers}
        teams={teams}
        freeAgents={freeAgents}
        isAdmin={session.user.role === "ADMIN"}
      />
    </div>
  );
}
