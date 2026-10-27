import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre del equipo debe tener al menos 3 caracteres")
    .max(40, "El nombre del equipo puede tener máximo 40 caracteres"),
  // Solo ADMIN puede elegir a otro capitán; el resto crea el equipo con su
  // propia cuenta como capitán.
  captainId: z.string().uuid("Capitán inválido").optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const captainId =
      session.user.role === "ADMIN" && parsed.data.captainId
        ? parsed.data.captainId
        : session.user.id;

    // Equipo + capitán como miembro ACTIVE van juntos: si falla el segundo no
    // debe quedar un equipo huérfano sin capitán.
    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: { name, captainId },
      });
      await tx.teamMember.create({
        data: {
          userId: captainId,
          teamId: created.id,
          status: "ACTIVE",
        },
      });
      return created;
    });

    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAMS POST] Error:", err);
    return NextResponse.json({ error: "Error al crear el equipo" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // El roster completo expone integrantes de todos los equipos: requiere sesión.
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const availableForUser = searchParams.get("availableForUser") === "true";

    if (availableForUser) {
      // Find team IDs where the user already has an ACTIVE, PENDING, or REQUEST membership
      const existingMemberships = await prisma.teamMember.findMany({
        where: {
          userId: session.user.id,
          status: { in: ["ACTIVE", "PENDING", "REQUEST"] },
        },
        select: { teamId: true },
      });
      const excludeTeamIds = existingMemberships.map((m) => m.teamId);

      const teams = await prisma.team.findMany({
        where: {
          id: { notIn: excludeTeamIds },
        },
        include: {
          captain: { select: { id: true, username: true } },
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
          members: {
            where: { status: "ACTIVE" },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  riotGameName: true,
                  riotTagLine: true,
                  riotIconId: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(teams);
    }

    const teams = await prisma.team.findMany({
      include: {
        captain: { select: { id: true, username: true } },
        members: { include: { user: { select: { id: true, username: true } } } },
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
    });

    return NextResponse.json(teams);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAMS GET] Error:", err);
    return NextResponse.json({ error: "Error al obtener equipos" }, { status: 500 });
  }
}
