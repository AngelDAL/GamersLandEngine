import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";

const TOURNAMENT_STATUSES = [
  "DRAFT",
  "OPEN_REGISTRATION",
  "CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const BRACKET_TYPES = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
  "SWISS",
] as const;

// Los campos "de encabezado" (nombre, cupos, estado…) siguen el criterio
// anterior: un valor vacío o nulo se ignora y se conserva lo que ya había.
const patchSchema = z.object({
  // Vacío = se ignora (el formulario de edición puede mandar "" al limpiar).
  name: z
    .string({ message: "El nombre debe ser texto" })
    .trim()
    .max(120, "El nombre es demasiado largo")
    .nullish(),
  game: z
    .string({ message: "El juego debe ser texto" })
    .trim()
    .max(60, "El nombre del juego es demasiado largo")
    .nullish(),
  description: z.string().max(10000, "La descripción es demasiado larga").nullable().optional(),
  entryFee: z
    .number({ message: "La cuota debe ser un número" })
    .nonnegative("La cuota no puede ser negativa")
    .nullable()
    .optional(),
  maxTeams: z
    .number({ message: "El máximo de equipos debe ser un número" })
    .int("El máximo de equipos debe ser un número entero")
    .positive("El máximo de equipos debe ser mayor que cero")
    .nullish(),
  minTeams: z
    .number({ message: "El mínimo de equipos debe ser un número" })
    .int("El mínimo de equipos debe ser un número entero")
    .positive("El mínimo de equipos debe ser mayor que cero")
    .nullish(),
  bracketType: z
    .enum(BRACKET_TYPES, { message: "Tipo de llave no válido" })
    .nullish(),
  status: z
    .enum(TOURNAMENT_STATUSES, { message: "Estado de torneo no válido" })
    .nullish(),
  eventDate: z
    .string({ message: "La fecha del torneo debe ser texto" })
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "Fecha del torneo inválida",
    })
    .nullish(),
  registrationDeadline: z
    .string({ message: "La fecha límite debe ser texto" })
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "Fecha límite inválida",
    })
    .nullable()
    .optional(),
  location: z.string().max(300, "La ubicación es demasiado larga").nullable().optional(),
  rules: z.string().max(20000, "Las reglas son demasiado largas").nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true, avatarUrl: true } },
      organizers: {
        include: { user: { select: { id: true, username: true } } },
      },
      rounds: {
        include: {
          matches: {
            include: {
              winner: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      prizes: true,
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(tournament);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    // Solo ADMIN u ORGANIZER, y solo si es creador u organizador de ESTE torneo:
    // antes cualquier usuario autenticado podía editar cualquier torneo.
    if (!requireRole(session, ["ADMIN", "ORGANIZER"])) {
      return roleForbidden();
    }

    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        createdById: true,
        organizers: { where: { userId: session.user.id }, select: { id: true } },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }
    if (
      tournament.createdById !== session.user.id &&
      tournament.organizers.length === 0
    ) {
      return roleForbidden();
    }

    const raw = await req.json();
    const parsedBody = patchSchema.safeParse(raw);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    const data = parsedBody.data;

    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.game && { game: data.game }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.entryFee !== undefined && { entryFee: data.entryFee }),
        ...(data.maxTeams && { maxTeams: data.maxTeams }),
        ...(data.minTeams && { minTeams: data.minTeams }),
        ...(data.bracketType && { bracketType: data.bracketType }),
        ...(data.status && { status: data.status }),
        ...(data.eventDate && { eventDate: new Date(data.eventDate) }),
        ...(data.registrationDeadline !== undefined && {
          registrationDeadline: data.registrationDeadline
            ? new Date(data.registrationDeadline)
            : null,
        }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.rules !== undefined && { rules: data.rules }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TOURNAMENT PATCH] Error:", err);
    return NextResponse.json({ error: "Error al actualizar el torneo" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    // Borrar exige ADMIN además de estar en la organización del torneo.
    if (!requireRole(session, ["ADMIN"])) {
      return roleForbidden();
    }

    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        createdById: true,
        organizers: { where: { userId: session.user.id }, select: { id: true } },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }
    if (
      tournament.createdById !== session.user.id &&
      tournament.organizers.length === 0
    ) {
      return roleForbidden();
    }

    await prisma.tournament.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TOURNAMENT DELETE] Error:", err);
    return NextResponse.json({ error: "Error al eliminar el torneo" }, { status: 500 });
  }
}
