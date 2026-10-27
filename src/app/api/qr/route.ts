import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";

const scanSchema = z.object({
  code: z.string().trim().min(1, "Código QR requerido"),
});

// El QR real (PlayerQR) codifica el userId tal cual, y un userId es un uuid con
// guiones: partir por "-" y quedarse con el primer trozo —como se hacía— nunca
// encontraba al jugador. Se extrae el uuid completo y se ignora cualquier
// sufijo (firma/fecha) que se agregue al código.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * POST /api/qr — lookup de escaneo (premios e historial del jugador escaneado).
 * Solo ADMIN, ORGANIZER y SPONSOR. Un SPONSOR solo ve premios de SU patrocinio:
 * el filtro anterior usaba `undefined` y le abría los premios de todos.
 */
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    if (!requireRole(session, ["ADMIN", "ORGANIZER", "SPONSOR"])) {
      return roleForbidden();
    }

    const body = await req.json();
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    // El código puede ser: userId (consulta directa) o userId-firma (QR escaneado)
    const match = parsed.data.code.match(UUID_RE);
    const userId = match ? match[0] : parsed.data.code;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        registrations: {
          include: {
            tournament: { select: { id: true, name: true, game: true, status: true } },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        matchResults: {
          include: {
            match: {
              include: {
                round: {
                  include: { tournament: { select: { id: true, name: true, game: true } } },
                },
              },
            },
          },
          orderBy: { match: { round: { roundNumber: "desc" } } },
          take: 20,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let availablePrizes: {
      id: string;
      name: string;
      tournament: { id: string; name: string };
      _count: { claims: number };
    }[] = [];

    if (requireRole(session, ["ADMIN", "ORGANIZER", "SPONSOR"])) {
      // SPONSOR: solo premios propios. ADMIN/ORGANIZER: todos los del torneo.
      const prizeWhere =
        session.user.role === "SPONSOR"
          ? { sponsorId: session.user.id }
          : {};

      availablePrizes = await prisma.prize.findMany({
        where: {
          tournamentId: { in: user.registrations.map((r) => r.tournamentId) },
          ...prizeWhere,
        },
        include: {
          tournament: { select: { id: true, name: true } },
          _count: { select: { claims: true } },
        },
      });

      // Se excluyen los ya reclamados por el jugador escaneado.
      const claimedIds = (
        await prisma.prizeClaim.findMany({
          where: { userId: user.id },
          select: { prizeId: true },
        })
      ).map((c) => c.prizeId);

      availablePrizes = availablePrizes.filter((p) => !claimedIds.includes(p.id));
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      tournaments: user.registrations.map((r) => ({
        tournament: r.tournament,
        team: r.team,
        status: r.status,
      })),
      matchHistory: user.matchResults.map((r) => ({
        result: r.result,
        score: r.score,
        tournament: r.match.round.tournament.name,
        game: r.match.round.tournament.game,
      })),
      availablePrizes,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[QR POST] Error:", err);
    return NextResponse.json({ error: "Error al consultar el código" }, { status: 500 });
  }
}
