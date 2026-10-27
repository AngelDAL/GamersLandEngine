import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageTournament } from "@/lib/tournament-server";

const updateSchema = z
  .object({
    status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
    paid: z.boolean().optional(),
    checkedIn: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.paid !== undefined || d.checkedIn !== undefined, {
    message: "Nada que actualizar",
  });

async function findRegistration(tournamentId: string, regId: string) {
  return prisma.tournamentRegistration.findFirst({
    where: { id: regId, tournamentId },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: tournamentId, regId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede modificar inscripciones" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message === "Nada que actualizar" ? issue.message : "Datos de inscripción no válidos" },
      { status: 400 }
    );
  }

  const registration = await findRegistration(tournamentId, regId);
  if (!registration) {
    return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }

  const effectiveStatus = parsed.data.status ?? registration.status;

  // El pago solo aplica a inscripciones aprobadas.
  if (parsed.data.paid !== undefined && effectiveStatus !== "CONFIRMED") {
    return NextResponse.json({ error: "El pago solo se marca en inscripciones aprobadas" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { isTeamBased: true },
  });

  const previousStatus = registration.status;

  const updated = await prisma.$transaction(async (tx) => {
    const reg = await tx.tournamentRegistration.update({
      where: { id: regId },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.paid !== undefined ? { paid: parsed.data.paid } : {}),
        ...(parsed.data.checkedIn !== undefined
          ? { checkedInAt: parsed.data.checkedIn ? new Date() : null }
          : {}),
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Al confirmar garantizamos que el equipo aparezca en la llave; al dejar
    // de estar confirmada, el equipo se retira si ya no queda nadie
    // confirmado (libera cupo).
    if (tournament?.isTeamBased && reg.teamId) {
      if (reg.status === "CONFIRMED") {
        const exists = await tx.tournamentTeam.findUnique({
          where: { tournamentId_teamId: { tournamentId, teamId: reg.teamId } },
        });
        if (!exists) await tx.tournamentTeam.create({ data: { tournamentId, teamId: reg.teamId } });
      } else {
        const confirmedLeft = await tx.tournamentRegistration.count({
          where: { tournamentId, teamId: reg.teamId, status: "CONFIRMED" },
        });
        if (confirmedLeft === 0) {
          await tx.tournamentTeam.deleteMany({ where: { tournamentId, teamId: reg.teamId } });
        }
      }
    }

    if (parsed.data.status && parsed.data.status !== previousStatus) {
      await tx.notification.create({
        data: {
          userId: reg.userId,
          type: "registration_status",
          title: "Inscripción en el torneo",
          message:
            parsed.data.status === "CONFIRMED"
              ? "Tu inscripción fue aprobada por el organizador"
              : parsed.data.status === "REJECTED"
                ? "Tu inscripción fue rechazada por el organizador"
                : "Tu inscripción volvió a estado pendiente",
          redirectUrl: `/tournaments/${tournamentId}`,
        },
      });
    }

    return reg;
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: tournamentId, regId } = await params;
  if (!(await canManageTournament(tournamentId, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede eliminar inscripciones" }, { status: 403 });
  }

  const registration = await findRegistration(tournamentId, regId);
  if (!registration) {
    return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.tournamentRegistration.delete({ where: { id: regId } });
    if (registration.teamId) {
      const confirmedLeft = await tx.tournamentRegistration.count({
        where: { tournamentId, teamId: registration.teamId, status: "CONFIRMED" },
      });
      if (confirmedLeft === 0) {
        await tx.tournamentTeam.deleteMany({ where: { tournamentId, teamId: registration.teamId } });
      }
    }
  });

  return NextResponse.json({ success: true });
}
