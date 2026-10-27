import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessChatRoom } from "@/lib/permissions";
import { getIO } from "@/socket/server";

async function resolveChatRoom(roomId: string): Promise<string> {
  if (roomId.startsWith("team:")) {
    const teamId = roomId.slice(5);
    const existing = await prisma.chatRoom.findFirst({ where: { teamId } });
    if (existing) return existing.id;
    const created = await prisma.chatRoom.create({ data: { type: "TEAM", teamId } });
    return created.id;
  }
  if (roomId.startsWith("match:")) {
    const matchId = roomId.slice(6);
    const existing = await prisma.chatRoom.findFirst({ where: { matchId } });
    if (existing) return existing.id;
    const created = await prisma.chatRoom.create({ data: { type: "MATCH", matchId } });
    return created.id;
  }
  return roomId;
}

const sendSchema = z.object({
  roomId: z.string().min(1, "Sala requerida"),
  content: z.string().max(5000, "El mensaje es demasiado largo").optional(),
  imageUrl: z.string().max(500, "La ruta de la imagen es demasiado larga").optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    const { roomId, content, imageUrl } = parsed.data;
    if (!content && !imageUrl) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Solo se escribe en salas donde el usuario pertenece al equipo o participa
    // en el partido (o es ADMIN).
    const allowed = await canAccessChatRoom(roomId, session.user.id, session.user.role);
    if (!allowed) {
      return NextResponse.json(
        { error: "No perteneces a esta sala de chat" },
        { status: 403 }
      );
    }

    const resolvedId = await resolveChatRoom(roomId);

    const message = await prisma.chatMessage.create({
      data: {
        roomId: resolvedId,
        senderId: session.user.id,
        content: content || "",
        imageUrl: imageUrl || undefined,
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    try {
      const io = getIO();
      io.to(resolvedId).emit("chat:message", message);
      if (resolvedId !== roomId) {
        io.to(roomId).emit("chat:message", message);
      }
    } catch {
      // Sin socket activo el mensaje ya quedó persistido en BD.
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[MESSAGES SEND] Error:", err);
    return NextResponse.json({ error: "Error al enviar el mensaje" }, { status: 500 });
  }
}
