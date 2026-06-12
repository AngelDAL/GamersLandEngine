import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");

  if (!roomId) {
    return NextResponse.json({ messages: [] });
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
}
