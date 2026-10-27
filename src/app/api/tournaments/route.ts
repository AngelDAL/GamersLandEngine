import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Estados reales del enum TournamentStatus: el filtro se valida contra esta
// lista porque un valor desconocido haría fallar a Prisma con 500.
const TOURNAMENT_STATUSES = [
  "DRAFT",
  "OPEN_REGISTRATION",
  "CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

// SWISS no está implementado: se rechaza con 400 en vez de caer en silencio a
// eliminación simple (decisión de producto del dueño).
const BRACKET_TYPES = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
] as const;

const createSchema = z.object({
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(80),
  game: z.string().trim().min(1, "Indica el juego"),
  description: z.string().max(4000).nullish(),
  entryFee: z.coerce.number().min(0, "La cuota no puede ser negativa").nullish(),
  maxTeams: z.coerce.number().int().min(2, "El cupo mínimo es de 2"),
  minTeams: z.coerce.number().int().min(1).nullish(),
  isTeamBased: z.coerce.boolean().nullish(),
  teamSize: z.coerce.number().int().min(1).max(10).nullish(),
  bracketType: z.string(),
  eventDate: z.string().min(1, "Falta la fecha del torneo"),
  registrationDeadline: z.string().nullish(),
  location: z.string().max(200).nullish(),
  rules: z.string().max(10000).nullish(),
  imageUrl: z.string().max(500).nullish(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const game = searchParams.get("game");

  if (status && !(TOURNAMENT_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Estado de torneo no válido" }, { status: 400 });
  }

  const where: { status?: (typeof TOURNAMENT_STATUSES)[number]; game?: string } = {};
  if (status) where.status = status as (typeof TOURNAMENT_STATUSES)[number];
  if (game) where.game = game;

  const tournaments = await prisma.tournament.findMany({
    where,
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { registrations: true, rounds: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  return NextResponse.json(tournaments);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "ORGANIZER") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  if (
    typeof (body as Record<string, unknown>).bracketType !== "string" ||
    !(BRACKET_TYPES as readonly string[]).includes(
      (body as Record<string, unknown>).bracketType as string
    )
  ) {
    return NextResponse.json({ error: "Modalidad no disponible" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "datos"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ error: detail || "Datos del torneo inválidos" }, { status: 400 });
  }

  const d = parsed.data;
  const eventDate = new Date(d.eventDate);
  if (isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: "La fecha del torneo no es válida" }, { status: 400 });
  }

  const minTeams = d.minTeams ?? 4;
  if (minTeams > d.maxTeams) {
    return NextResponse.json(
      { error: "El mínimo de equipos no puede superar el cupo" },
      { status: 400 }
    );
  }

  let registrationDeadline: Date | null = null;
  if (d.registrationDeadline) {
    registrationDeadline = new Date(d.registrationDeadline);
    if (isNaN(registrationDeadline.getTime())) {
      return NextResponse.json({ error: "La fecha límite no es válida" }, { status: 400 });
    }
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: d.name,
      game: d.game,
      description: d.description ?? null,
      entryFee: d.entryFee ?? 0,
      maxTeams: d.maxTeams,
      minTeams,
      isTeamBased: d.isTeamBased ?? true,
      teamSize: d.teamSize ?? 5,
      bracketType: d.bracketType as (typeof BRACKET_TYPES)[number],
      eventDate,
      registrationDeadline,
      location: d.location ?? null,
      rules: d.rules ?? null,
      imageUrl: d.imageUrl || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(tournament, { status: 201 });
}
