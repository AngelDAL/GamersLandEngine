import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const updatePrizeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).nullish(),
  type: z.enum(["POSITION", "PARTICIPATION", "SPONSOR_GIFT"]).optional(),
  position: z.number().int().min(1).max(64).nullish(),
  value: z.string().max(500).nullish(),
  imageUrl: z.string().max(2048).nullish(),
  maxClaims: z.number().int().min(1).max(100000).nullish(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" &&
      session.user.role !== "ORGANIZER" &&
      session.user.role !== "SPONSOR")
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, prizeId } = await params;

  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  // El premio debe pertenecer al torneo de la URL
  if (!prize || prize.tournamentId !== id) {
    return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });
  }

  // Un patrocinador solo puede tocar premios propios
  if (session.user.role === "SPONSOR" && prize.sponsorId !== session.user.id) {
    return NextResponse.json({ error: "Este premio pertenece a otro patrocinador" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updatePrizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const updated = await prisma.prize.update({
    where: { id: prizeId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, prizeId } = await params;

  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize || prize.tournamentId !== id) {
    return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });
  }

  await prisma.prize.delete({ where: { id: prizeId } });
  return NextResponse.json({ success: true });
}
