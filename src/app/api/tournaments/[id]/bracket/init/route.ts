import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  canManageTournament,
  createEmptyBracket,
  deleteRoundsOfTournament,
  emitBracketUpdated,
} from "@/lib/tournament-server";

const initSchema = z.object({ numSlots: z.number().int().min(2, "Se requieren al menos 2 slots").max(256) });

const EDITABLE_STATUSES = ["DRAFT", "OPEN_REGISTRATION"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede construir la llave" }, { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(tournament.status)) {
    return NextResponse.json(
      { error: "La llave manual solo se edita durante la planeación o con las inscripciones abiertas" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = initSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    await deleteRoundsOfTournament(id, tx);
    return createEmptyBracket(tx, id, parsed.data.numSlots);
  });

  emitBracketUpdated(id);

  return NextResponse.json({ rounds: created.rounds, numSlots: created.numSlots, numRounds: created.numRounds }, { status: 201 });
}
