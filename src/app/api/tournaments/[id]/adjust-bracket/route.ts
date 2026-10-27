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

const adjustSchema = z.object({
  numSlots: z
    .number({ message: "Se requiere el tamaño de la llave (numSlots)" })
    .int("numSlots debe ser un entero")
    .min(2, "Se requieren al menos 2 slots")
    .max(256, "Máximo 256 slots"),
});

const EDITABLE_STATUSES = ["DRAFT", "OPEN_REGISTRATION"] as const;

/**
 * Cambia el TAMAÑO de la llave: regenera la estructura vacía del torneo con
 * el número de slots indicado (en transacción). El cupo del torneo se edita
 * desde la ficha del torneo (PATCH /api/tournaments/[id]), no aquí.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session))) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede ajustar la llave" }, { status: 403 });
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
      { error: "La llave solo se ajusta durante la planeación o con las inscripciones abiertas" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = adjustSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    await deleteRoundsOfTournament(id, tx);
    return createEmptyBracket(tx, id, parsed.data.numSlots);
  });

  emitBracketUpdated(id);

  return NextResponse.json({
    message: "La llave se regeneró con el nuevo tamaño",
    numSlots: created.numSlots,
    numRounds: created.numRounds,
    rounds: created.rounds,
  });
}
