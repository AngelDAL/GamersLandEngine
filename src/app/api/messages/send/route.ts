import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { roomId, content, imageUrl } = await req.json();
  if (!roomId || (!content && !imageUrl)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
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

  // Broadcast to Socket.io clients if available
  try {
    const io = getIO();
    io.to(resolvedId).emit("chat:message", message);
    if (resolvedId !== roomId) {
      io.to(roomId).emit("chat:message", message);
    }
  } catch {}

  return NextResponse.json(message, { status: 201 });
}
