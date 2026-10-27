import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, roleForbidden } from "@/lib/permissions";
import { getIO } from "@/socket/server";

const inviteSchema = z.object({
  userId: z.string().uuid("Usuario inválido"),
  message: z.string().max(300, "El mensaje no puede superar 300 caracteres").optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    const { userId, message } = parsed.data;

    // Solo el capitán del equipo o un ADMIN pueden invitar.
    const team = await prisma.team.findUnique({
      where: { id },
      select: { captainId: true, name: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    if (team.captainId !== session.user.id && session.user.role !== "ADMIN") {
      return roleForbidden();
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "No puedes invitarte a ti mismo" },
        { status: 400 }
      );
    }

    // El status del body se ignora: las invitaciones siempre nacen PENDING y
    // un capitán/admin las confirma después (evita auto-activación).
    const newStatus = "PENDING" as const;

    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: id } },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        return NextResponse.json({ error: "El usuario ya es miembro del equipo" }, { status: 409 });
      }
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { status: newStatus, message: message || null },
      });
    } else {
      await prisma.teamMember.create({
        data: { userId, teamId: id, status: newStatus, message: message || null },
      });
    }

    await prisma.notification.create({
      data: {
        userId,
        type: "team_invite",
        title: `Invitación a ${team.name}`,
        message: `${session.user.name} te ha invitado a unirte al equipo "${team.name}".${message ? `\nMensaje: ${message}` : ""}`,
        redirectUrl: `/teams/${id}`,
      },
    });

    // Aviso en vivo si el invitado tiene el socket conectado (respaldo: BD arriba).
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit("notification", {
        id: `${Date.now()}`,
        type: "team_invite",
        title: `Invitación a ${team.name}`,
        message: `${session.user.name} te ha invitado a unirte al equipo "${team.name}".`,
        redirectUrl: `/teams/${id}`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    } catch {
      // Sin socket activo la invitación igual queda registrada en BD.
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[TEAM INVITE] Error:", err);
    return NextResponse.json({ error: "Error al invitar al miembro" }, { status: 500 });
  }
}
