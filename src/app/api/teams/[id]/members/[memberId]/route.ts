import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, roleForbidden } from "@/lib/permissions";
import type { MemberStatus } from "@/generated/prisma/enums";

const MEMBER_STATUSES: MemberStatus[] = ["PENDING", "ACTIVE", "REJECTED", "REQUEST"];

const patchSchema = z
  .object({
    status: z
      .enum(MEMBER_STATUSES as [MemberStatus, ...MemberStatus[]], {
        message: "Estado de miembro no válido",
      })
      .optional(),
    lane: z.string().max(20, "La línea es demasiado larga").optional(),
  })
  .refine((d) => d.status !== undefined || d.lane !== undefined, {
    message: "No hay nada que actualizar",
  });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await requireAuth();

    const { memberId } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: { select: { captainId: true } } },
    });
    if (!member) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    const isCaptain = member.team.captainId === session.user.id;
    const isSelf = member.userId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isCaptain && !isSelf && !isAdmin) {
      return roleForbidden();
    }

    const data: { status?: MemberStatus; lane?: string } = {};

    // Cambiar estado (aceptar/rechazar) es solo capitán o ADMIN: un PENDING no
    // puede auto-promoverse a ACTIVE desde su propia cuenta.
    if (parsed.data.status !== undefined) {
      if (!isCaptain && !isAdmin) {
        return roleForbidden();
      }
      data.status = parsed.data.status;
    }

    // Cualquiera con acceso puede actualizar su propia lane; el capitán/admin
    // también la de sus miembros.
    if (parsed.data.lane !== undefined) {
      if (!isSelf && !isCaptain && !isAdmin) {
        return roleForbidden();
      }
      data.lane = parsed.data.lane;
    }

    const updated = await prisma.teamMember.update({
      where: { id: memberId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAM MEMBER PATCH] Error:", err);
    return NextResponse.json({ error: "Error al actualizar el miembro" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await requireAuth();

    const { memberId } = await params;
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: { select: { captainId: true } } },
    });
    if (!member) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    const isCaptain = member.team.captainId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    // La salida voluntaria vive en /teams/[id]/leave; aquí solo expulsa
    // capitán o ADMIN.
    if (!isCaptain && !isAdmin) {
      return roleForbidden();
    }

    await prisma.teamMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAM MEMBER DELETE] Error:", err);
    return NextResponse.json({ error: "Error al eliminar el miembro" }, { status: 500 });
  }
}
