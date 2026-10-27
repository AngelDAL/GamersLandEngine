import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

const ROLES: Role[] = ["ADMIN", "ORGANIZER", "PLAYER", "SPONSOR", "EXPOSITOR", "EJECUTIVO"];

const patchSchema = z
  .object({
    role: z
      .enum(ROLES as [Role, ...Role[]], { message: "Rol no válido" })
      .optional(),
    avatarUrl: z.string().max(500, "La ruta del avatar es demasiado larga").optional(),
  })
  .refine((d) => d.role !== undefined || d.avatarUrl !== undefined, {
    message: "No hay nada que actualizar",
  });

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAuth();
    const { userId } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    // Cambiar el rol es exclusivo de ADMIN; el avatar lo puede cambiar cualquiera
    // sobre su propia cuenta.
    if (parsed.data.role !== undefined) {
      if (!requireRole(session, ["ADMIN"])) {
        return roleForbidden();
      }
      if (userId === session.user.id && parsed.data.role !== "ADMIN") {
        return NextResponse.json(
          { error: "No puedes cambiar tu propio rol" },
          { status: 403 }
        );
      }
    } else if (userId !== session.user.id) {
      return roleForbidden();
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(parsed.data.role && { role: parsed.data.role }),
        ...(parsed.data.avatarUrl !== undefined && { avatarUrl: parsed.data.avatarUrl }),
      },
      select: { id: true, username: true, role: true, avatarUrl: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    // Usuario inexistente: Prisma lanza P2025 en update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    console.error("[USER PATCH] Error:", err);
    return NextResponse.json({ error: "Error al actualizar el usuario" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAuth();
    if (!requireRole(session, ["ADMIN"])) {
      return roleForbidden();
    }

    const { userId } = await params;
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    // FK Restint sobre Tournament.createdById y Team.captainId: se responde 409
    // en lugar del 500 opaco que devolvía Prisma.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "Primero reasigna o elimina sus torneos/equipos" },
        { status: 409 }
      );
    }
    console.error("[USER DELETE] Error:", err);
    return NextResponse.json({ error: "Error al eliminar el usuario" }, { status: 500 });
  }
}
