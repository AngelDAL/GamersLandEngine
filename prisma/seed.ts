import { PrismaClient } from "../src/generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = new URL(process.env.DATABASE_URL || "mysql://root:@localhost:3306/gamersland");
const adapter = new PrismaMariaDb({
  host: url.hostname || "localhost",
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // ── USERS ──
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", role: "ADMIN" },
  });

  const organizer1 = await prisma.user.upsert({
    where: { username: "organizador1" },
    update: {},
    create: { username: "organizador1", role: "ORGANIZER" },
  });

  const organizer2 = await prisma.user.upsert({
    where: { username: "org_lol" },
    update: {},
    create: { username: "org_lol", role: "ORGANIZER" },
  });

  const sponsor = await prisma.user.upsert({
    where: { username: "sponsor1" },
    update: {},
    create: { username: "sponsor1", role: "SPONSOR" },
  });

  const playerNames = [
    "Jugador1", "Jugador2", "Jugador3", "Jugador4",
    "ProPlayer", "NoobMaster", "DiamondHands", "SilverSurfer",
    "MegaKiller", "TryHarder", "MidOrFeed", "SupportMain",
  ];
  const playerIds: string[] = [];
  for (const name of playerNames) {
    const u = await prisma.user.upsert({
      where: { username: name },
      update: {},
      create: { username: name, role: "PLAYER" },
    });
    playerIds.push(u.id);
  }

  // ── TEAMS ──
  const teamData = [
    { name: "Los Pro Players", captain: playerIds[0] },
    { name: "Elite Squad", captain: playerIds[1] },
    { name: "Dark Warriors", captain: playerIds[2] },
    { name: "Shadow Gaming", captain: playerIds[3] },
    { name: "Phoenix Rising", captain: playerIds[4] },
    { name: "Dragon Slayers", captain: playerIds[5] },
    { name: "Diamond Crew", captain: playerIds[6] },
    { name: "Silver Hawks", captain: playerIds[7] },
  ];

  const teamIds: string[] = [];
  for (const td of teamData) {
    const existing = await prisma.team.findFirst({ where: { name: td.name } });
    if (existing) {
      teamIds.push(existing.id);
      continue;
    }
    const team = await prisma.team.create({
      data: { name: td.name, captainId: td.captain },
    });
    await prisma.teamMember.create({
      data: { userId: td.captain, teamId: team.id, status: "ACTIVE" },
    });
    teamIds.push(team.id);
  }

  // Add extra members to some teams
  const extraMembers = [
    { teamIdx: 0, playerIdx: 8 },
    { teamIdx: 0, playerIdx: 9 },
    { teamIdx: 1, playerIdx: 10 },
    { teamIdx: 2, playerIdx: 11 },
    { teamIdx: 5, playerIdx: 8 },
  ];
  for (const m of extraMembers) {
    const exists = await prisma.teamMember.findFirst({
      where: { userId: playerIds[m.playerIdx], teamId: teamIds[m.teamIdx] },
    });
    if (!exists) {
      await prisma.teamMember.create({
        data: { userId: playerIds[m.playerIdx], teamId: teamIds[m.teamIdx], status: "ACTIVE" },
      });
    }
  }

  // Pending applications
  const pendingApps = [
    { teamIdx: 1, playerIdx: 5, msg: "Main mid, diamante 3, busco equipo serio para torneos" },
    { teamIdx: 0, playerIdx: 11, msg: "Support main, oro 1, experiencia en torneos locales" },
    { teamIdx: 3, playerIdx: 9, msg: "Jungle main, platino 2, disponible todo el evento" },
  ];
  for (const app of pendingApps) {
    const exists = await prisma.teamMember.findFirst({
      where: { userId: playerIds[app.playerIdx], teamId: teamIds[app.teamIdx] },
    });
    if (!exists) {
      await prisma.teamMember.create({
        data: {
          userId: playerIds[app.playerIdx],
          teamId: teamIds[app.teamIdx],
          status: "PENDING",
          message: app.msg,
        },
      });
    }
  }

  // ── LOL TOURNAMENT (OPEN) ──
  const existingLol = await prisma.tournament.findFirst({ where: { name: "LOL Cup #1" } });
  if (!existingLol) {
    const t = await prisma.tournament.create({
      data: {
        name: "LOL Cup #1",
        game: "LEAGUE_OF_LEGENDS",
        description: "Torneo oficial de League of Legends 5v5.\nFormato: Eliminación Simple.\n\nMapa: Grieta del Invocador.\nModalidad: Draft pick.\n\nTodos los participantes deben estar presentes 30 min antes.",
        maxTeams: 8,
        minTeams: 4,
        bracketType: "SINGLE_ELIMINATION",
        status: "OPEN_REGISTRATION",
        eventDate: new Date("2026-07-01T14:00:00"),
        registrationDeadline: new Date("2026-06-28T23:59:00"),
        location: "Stand B - Zona Principal de Gaming",
        entryFee: 100,
        createdById: admin.id,
      },
    });

    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: admin.id } });
    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: organizer1.id } });

    for (let i = 0; i < 4; i++) {
      await prisma.tournamentTeam.create({ data: { tournamentId: t.id, teamId: teamIds[i] } });
    }
    for (const pid of playerIds.slice(0, 6)) {
      await prisma.tournamentRegistration.create({
        data: { tournamentId: t.id, userId: pid, status: "CONFIRMED", registeredBy: admin.id },
      });
    }

    await prisma.prize.createMany({
      data: [
        { tournamentId: t.id, name: "1er Lugar", type: "POSITION", position: 1, value: "$2,000 MXN + Trophy" },
        { tournamentId: t.id, name: "2do Lugar", type: "POSITION", position: 2, value: "$1,000 MXN" },
        { tournamentId: t.id, name: "3er Lugar", type: "POSITION", position: 3, value: "$500 MXN" },
        { tournamentId: t.id, name: "Participación", type: "PARTICIPATION", value: "Descuento 10% en tienda Z", sponsorId: sponsor.id },
      ],
    });
  }

  // ── LOL 1v1 (OPEN) ──
  const existing1v1 = await prisma.tournament.findFirst({ where: { name: "LoL 1v1 Mid Showdown" } });
  if (!existing1v1) {
    const t = await prisma.tournament.create({
      data: {
        name: "LoL 1v1 Mid Showdown",
        game: "LOL_1V1",
        description: "Torneo 1v1 en la Grieta del Invocador.\nReglas:\n- Solo mid lane\n- First blood, 100 cs o torre gana\n- Prohibido farmear jungla\n- Los enfrentamientos son al mejor de 1 hasta semifinales, después al mejor de 3",
        maxTeams: 16,
        minTeams: 4,
        bracketType: "SINGLE_ELIMINATION",
        status: "OPEN_REGISTRATION",
        eventDate: new Date("2026-07-20T14:00:00"),
        registrationDeadline: new Date("2026-07-19T23:59:00"),
        location: "Stand C - Escenario 2",
        entryFee: 50,
        createdById: admin.id,
      },
    });
    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: organizer2.id } });

    await prisma.prize.createMany({
      data: [
        { tournamentId: t.id, name: "Campeón Absoluto", type: "POSITION", position: 1, value: "$1,500 MXN" },
        { tournamentId: t.id, name: "Subcampeón", type: "POSITION", position: 2, value: "$750 MXN" },
      ],
    });
  }

  // ── FORTNITE (OPEN) ──
  const existingFN = await prisma.tournament.findFirst({ where: { name: "Fortnite Squad Brawl" } });
  if (!existingFN) {
    const t = await prisma.tournament.create({
      data: {
        name: "Fortnite Squad Brawl",
        game: "FORTNITE",
        description: "Torneo por equipos de 4 jugadores.\n3 partidas con puntuación acumulada:\n- Victory Royale: 50 pts\n- 2do lugar: 35 pts\n- Cada eliminación: 3 pts\n\nGana el equipo con más puntos al final de las 3 partidas.",
        maxTeams: 12,
        minTeams: 4,
        bracketType: "ROUND_ROBIN",
        status: "OPEN_REGISTRATION",
        eventDate: new Date("2026-07-22T16:00:00"),
        registrationDeadline: new Date("2026-07-21T23:59:00"),
        location: "Stand A - Sala Fortnite",
        entryFee: 100,
        createdById: admin.id,
      },
    });
    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: organizer1.id } });
    await prisma.prize.createMany({
      data: [
        { tournamentId: t.id, name: "1er Lugar", type: "POSITION", position: 1, value: "$3,000 MXN" },
        { tournamentId: t.id, name: "2do Lugar", type: "POSITION", position: 2, value: "$1,500 MXN" },
        { tournamentId: t.id, name: "3er Lugar", type: "POSITION", position: 3, value: "$750 MXN" },
      ],
    });
  }

  // ── VALORANT (IN PROGRESS) ──
  const existingVal = await prisma.tournament.findFirst({ where: { name: "Valorant Showdown" } });
  if (!existingVal) {
    const t = await prisma.tournament.create({
      data: {
        name: "Valorant Showdown",
        game: "VALORANT",
        description: "Torneo de Valorant 5v5.\nModalidad: Doble Eliminación.\nMapas: Bind, Haven, Ascent (Ban/Pick).\nTodos los mapas al mejor de 1 hasta la final. La final es al mejor de 3.",
        maxTeams: 8,
        minTeams: 4,
        bracketType: "DOUBLE_ELIMINATION",
        status: "IN_PROGRESS",
        eventDate: new Date("2026-07-15T12:00:00"),
        location: "Sala VIP - Escenario Principal",
        entryFee: 150,
        createdById: admin.id,
      },
    });
    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: organizer1.id } });
    await prisma.tournamentOrganizer.create({ data: { tournamentId: t.id, userId: organizer2.id } });

    const valTeams = teamIds.slice(0, 4);
    for (const tid of valTeams) {
      await prisma.tournamentTeam.create({ data: { tournamentId: t.id, teamId: tid } });
    }

    const r1 = await prisma.tournamentRound.create({ data: { tournamentId: t.id, roundNumber: 1 } });
    await prisma.match.create({ data: { roundId: r1.id, team1Id: valTeams[0], team2Id: valTeams[1], score1: 13, score2: 8, winnerId: valTeams[0], bracketPosition: 0, status: "COMPLETED" } });
    await prisma.match.create({ data: { roundId: r1.id, team1Id: valTeams[2], team2Id: valTeams[3], score1: 6, score2: 13, winnerId: valTeams[3], bracketPosition: 1, status: "COMPLETED" } });

    const r2 = await prisma.tournamentRound.create({ data: { tournamentId: t.id, roundNumber: 2 } });
    await prisma.match.create({ data: { roundId: r2.id, team1Id: valTeams[0], team2Id: valTeams[3], bracketPosition: 0, status: "IN_PROGRESS" } });

    await prisma.prize.createMany({
      data: [
        { tournamentId: t.id, name: "1er Lugar", type: "POSITION", position: 1, value: "$4,000 MXN + Periféricos" },
        { tournamentId: t.id, name: "2do Lugar", type: "POSITION", position: 2, value: "$2,000 MXN" },
        { tournamentId: t.id, name: "MVP del Torneo", type: "PARTICIPATION", value: "Audífonos Gaming" },
      ],
    });
  }

  // ── COMPLETED DEMO TOURNAMENT ──
  const existingCompleted = await prisma.tournament.findFirst({ where: { name: "Valorant Cup Demo" } });
  if (!existingCompleted) {
    const t = await prisma.tournament.create({
      data: {
        name: "Valorant Cup Demo",
        game: "VALORANT",
        description: "Torneo demo utilizado para pruebas del sistema",
        maxTeams: 4,
        minTeams: 4,
        bracketType: "SINGLE_ELIMINATION",
        status: "COMPLETED",
        eventDate: new Date("2026-06-01T10:00:00"),
        location: "Sala de pruebas",
        createdById: admin.id,
      },
    });

    const teams = teamIds.slice(0, 4);
    for (const tid of teams) {
      await prisma.tournamentTeam.create({ data: { tournamentId: t.id, teamId: tid } });
    }

    const r1 = await prisma.tournamentRound.create({ data: { tournamentId: t.id, roundNumber: 1 } });
    const m1 = await prisma.match.create({ data: { roundId: r1.id, team1Id: teams[0], team2Id: teams[1], score1: 13, score2: 7, winnerId: teams[0], bracketPosition: 0, status: "COMPLETED" } });
    const m2 = await prisma.match.create({ data: { roundId: r1.id, team1Id: teams[2], team2Id: teams[3], score1: 6, score2: 13, winnerId: teams[3], bracketPosition: 1, status: "COMPLETED" } });

    const r2 = await prisma.tournamentRound.create({ data: { tournamentId: t.id, roundNumber: 2 } });
    await prisma.match.create({ data: { roundId: r2.id, team1Id: teams[0], team2Id: teams[3], score1: 13, score2: 11, winnerId: teams[0], bracketPosition: 0, status: "COMPLETED" } });

    await prisma.prize.create({ data: { tournamentId: t.id, name: "Ganador (Demo)", type: "POSITION", position: 1, value: "$0 (Demo)" } });

    for (let i = 0; i < 4; i++) {
      await prisma.matchResult.create({
        data: {
          matchId: i < 2 ? m1.id : m2.id,
          userId: playerIds[i],
          teamId: teams[i],
          result: (i === 0 || i === 3) ? "WON" : "LOST",
        },
      });
    }
  }

  console.log("Seed completado exitosamente.");
  console.log("Usuarios de prueba:");
  console.log("  admin (ADMIN) - Control total");
  console.log("  organizador1, org_lol (ORGANIZER)");
  console.log("  sponsor1 (SPONSOR)");
  console.log(`  ${playerNames.join(", ")} (PLAYER)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
