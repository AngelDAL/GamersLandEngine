import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessChatRoom } from "@/lib/permissions";

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

export async function GET(req: Request) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ messages: [] });
    }

    // La sala solo se materializa DESPUÉS de comprobar que el usuario pertenece
    // al equipo/partido: antes cualquier autenticado leía salas ajenas y de
    // paso creaba salas fantasma.
    const allowed = await canAccessChatRoom(roomId, session.user.id, session.user.role);
    if (!allowed) {
      return NextResponse.json(
        { error: "No perteneces a esta sala de chat" },
        { status: 403 }
      );
    }

    const resolvedId = await resolveChatRoom(roomId);

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: resolvedId },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ messages, roomId: resolvedId });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[MESSAGES GET] Error:", err);
    return NextResponse.json({ error: "Error al obtener los mensajes" }, { status: 500 });
  }
}
