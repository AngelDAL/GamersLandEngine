import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  canManageTournament,
  countEntrants,
  userBelongsToTeam,
} from "@/lib/tournament-server";

const createSchema = z.object({
  userId: z.string().min(1).optional(),
  teamId: z.string().min(1).nullable().optional(),
});

const listSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede ver las inscripciones" }, { status: 403 });
  }

  const parsedStatus = listSchema.safeParse({
    status: new URL(req.url).searchParams.get("status") ?? undefined,
  });
  if (!parsedStatus.success) {
    return NextResponse.json({ error: "Estado de inscripción no válido" }, { status: 400 });
  }

  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId: id,
      ...(parsedStatus.data.status ? { status: parsedStatus.data.status } : {}),
    },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true, email: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(registrations);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsedBody = createSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Datos de inscripción no válidos" }, { status: 400 });
  }

  const targetId = parsedBody.data.userId || session.user.id;
  const teamId = parsedBody.data.teamId ?? undefined;
  const isSelf = targetId === session.user.id;
  const isManager = await canManageTournament(id, session);

  // Solo el organizador puede inscribir a otra persona; cualquiera se
  // inscribe a sí mismo.
  if (!isSelf && !isManager) {
    return NextResponse.json({ error: "No puedes inscribir a otro jugador" }, { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, status: true, isTeamBased: true, maxTeams: true, registrationDeadline: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  // El organizador gestiona el alta cuando quiera; el jugador solo mientras
  // las inscripciones están abiertas y antes de la fecha límite.
  if (!isManager && tournament.status !== "OPEN_REGISTRATION") {
    return NextResponse.json({ error: "Las inscripciones no están abiertas" }, { status: 400 });
  }
  if (!isManager && tournament.registrationDeadline && tournament.registrationDeadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "La fecha límite de inscripción ya pasó" }, { status: 400 });
  }

  const existing = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: targetId } },
  });
  if (existing) {
    return NextResponse.json({ error: "El jugador ya está inscrito en este torneo" }, { status: 409 });
  }

  if (tournament.isTeamBased) {
    // El jugador que se inscribe a sí mismo debe indicar su equipo; el
    // organizador puede dar de alta agentes libres sin equipo.
    if (isSelf && !teamId) {
      return NextResponse.json({ error: "Selecciona el equipo con el que te inscribirás" }, { status: 400 });
    }
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
      if (!team) {
        return NextResponse.json({ error: "El equipo no existe" }, { status: 404 });
      }
      if (!(await userBelongsToTeam(teamId, targetId))) {
        return NextResponse.json({ error: "Ese jugador no pertenece al equipo indicado" }, { status: 403 });
      }
    }
  }

  // Cupo: las inscripciones PENDING y los equipos con solicitud PENDING
  // también ocupan lugar (evita vender dos veces el último cupo).
  const entrants = await countEntrants(id, tournament.isTeamBased);
  const teamAlreadyCounted =
    tournament.isTeamBased && teamId
      ? (await prisma.tournamentTeam.findUnique({
          where: { tournamentId_teamId: { tournamentId: id, teamId } },
          select: { id: true },
        })) ||
        (await prisma.tournamentRegistration.findFirst({
          where: { tournamentId: id, status: "PENDING", teamId },
          select: { id: true },
        }))
      : null;
  if (!teamAlreadyCounted && entrants >= tournament.maxTeams) {
    return NextResponse.json({ error: "El torneo ya no tiene cupos disponibles" }, { status: 400 });
  }

  // El organizador que da de alta a otro jugador lo aprueba de inmediato
  // (es él quien lo registra); la autoinscripción queda PENDING.
  const status = isManager && !isSelf ? "CONFIRMED" : "PENDING";

  const registration = await prisma.$transaction(async (tx) => {
    const created = await tx.tournamentRegistration.create({
      data: {
        tournamentId: id,
        userId: targetId,
        teamId: teamId ?? null,
        status,
        registeredBy: session.user.id,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
    });
    if (status === "CONFIRMED" && tournament.isTeamBased && teamId) {
      const existingTeam = await tx.tournamentTeam.findUnique({
        where: { tournamentId_teamId: { tournamentId: id, teamId } },
      });
      if (!existingTeam) await tx.tournamentTeam.create({ data: { tournamentId: id, teamId } });
    }
    return created;
  });

  return NextResponse.json(registration, { status: 201 });
}
