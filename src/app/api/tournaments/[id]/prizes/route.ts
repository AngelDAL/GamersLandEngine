import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET público: premios de un torneo con lo que el jugador necesita ver
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const prizes = await prisma.prize.findMany({
    where: { tournamentId: id },
    include: {
      sponsor: { select: { id: true, username: true } },
      _count: { select: { claims: true } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(prizes);
}

const createPrizeSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    description: z.string().max(2000).nullish(),
    type: z.enum(["POSITION", "PARTICIPATION", "SPONSOR_GIFT"]),
    position: z.number().int().min(1).max(64).nullish(),
    value: z.string().max(500).nullish(),
    sponsorId: z.string().min(1).nullish(),
    imageUrl: z.string().max(2048).nullish(),
    maxClaims: z.number().int().min(1).max(100000).nullish(),
  })
  .refine((d) => d.type !== "POSITION" || (d.position != null && d.position > 0), {
    message: "Indica el puesto del premio (posición)",
    path: ["position"],
  });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" &&
      session.user.role !== "ORGANIZER" &&
      session.user.role !== "SPONSOR")
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createPrizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Un patrocinador siempre crea premios a su nombre; el id del body se ignora.
  const sponsorId =
    session.user.role === "SPONSOR"
      ? session.user.id
      : (data.sponsorId ?? null);

  try {
    const prize = await prisma.prize.create({
      data: {
        tournamentId: id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        position: data.type === "POSITION" ? data.position : (data.position ?? null),
        value: data.value ?? null,
        sponsorId,
        imageUrl: data.imageUrl ?? null,
        maxClaims: data.maxClaims ?? null,
      },
    });
    return NextResponse.json(prize, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo crear el premio. Intenta de nuevo." },
      { status: 500 },
    );
  }
}
