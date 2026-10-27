import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const userSchema = z.object({ userId: z.string().min(1, "Falta el usuario") });

/**
 * Alta/baja de organizadores del torneo: solo el ADMIN o el creador del
 * torneo. Sin duplicados (409) y sin tocar al creador.
 */
async function assertCanManageCreators(tournamentId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado", status: 401 } as const;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, createdById: true },
  });
  if (!tournament) return { error: "Torneo no encontrado", status: 404 } as const;
  if (session.user.role !== "ADMIN" && tournament.createdById !== session.user.id) {
    return { error: "Solo el creador del torneo o un administrador puede gestionar organizadores", status: 403 } as const;
  }
  return { session, tournament } as const;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertCanManageCreators((await params).id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { userId } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const existing = await prisma.tournamentOrganizer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Este usuario ya es organizador del torneo" }, { status: 409 });
  }

  const organizer = await prisma.tournamentOrganizer.create({
    data: { tournamentId: id, userId },
  });

  return NextResponse.json(organizer, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertCanManageCreators((await params).id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }
  const { userId } = parsed.data;

  const tournament = guard.tournament;
  if (tournament.createdById === userId) {
    return NextResponse.json({ error: "El creador del torneo no puede quitarse como organizador" }, { status: 400 });
  }

  const existing = await prisma.tournamentOrganizer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Este usuario no es organizador del torneo" }, { status: 404 });
  }

  await prisma.tournamentOrganizer.delete({ where: { id: existing.id } });

  return NextResponse.json({ success: true });
}
