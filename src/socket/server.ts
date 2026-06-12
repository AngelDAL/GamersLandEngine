import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";

let io: SocketIOServer;

function parseRoomId(roomId: string): { type: string; id: string } | null {
  if (roomId.startsWith("team:")) return { type: "team", id: roomId.slice(5) };
  if (roomId.startsWith("match:")) return { type: "match", id: roomId.slice(6) };
  return null;
}

async function resolveChatRoom(roomId: string): Promise<string> {
  const parsed = parseRoomId(roomId);
  if (!parsed) return roomId; // Already a UUID or unknown format

  if (parsed.type === "team") {
    const existing = await prisma.chatRoom.findFirst({ where: { teamId: parsed.id } });
    if (existing) return existing.id;

    const created = await prisma.chatRoom.create({ data: { type: "TEAM", teamId: parsed.id } });
    return created.id;
  }

  if (parsed.type === "match") {
    const existing = await prisma.chatRoom.findFirst({ where: { matchId: parsed.id } });
    if (existing) return existing.id;

    const created = await prisma.chatRoom.create({ data: { type: "MATCH", matchId: parsed.id } });
    return created.id;
  }

  return roomId;
}

export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string;

    // Auto-join user's personal room for notifications
    if (userId) socket.join(`user:${userId}`);

    socket.on("chat:join", async (roomId: string) => {
      const resolvedId = await resolveChatRoom(roomId);
      socket.join(resolvedId);
      if (resolvedId !== roomId) socket.join(roomId);
    });

    socket.on("chat:leave", (roomId: string) => {
      socket.leave(roomId);
    });

    socket.on("chat:message", async (data: { roomId: string; content: string }) => {
      if (!userId) return;

      const resolvedId = await resolveChatRoom(data.roomId);
      const roomIdToUse = resolvedId || data.roomId;

      // Build the message data without Prisma relation first to check
      const messageData: any = {
        roomId: roomIdToUse,
        senderId: userId,
        content: data.content,
      };

      const message = await prisma.chatMessage.create({
        data: messageData,
        include: {
          sender: { select: { id: true, username: true, avatarUrl: true } },
        },
      });

      // Emit to both the resolved ID and the original prefixed ID
      io.to(resolvedId).emit("chat:message", message);
      if (resolvedId !== data.roomId) {
        io.to(data.roomId).emit("chat:message", message);
      }
    });

    socket.on("notification:send", (data: { userId: string; message: string }) => {
      io.to(`user:${data.userId}`).emit("notification", {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function emitBracketUpdate(tournamentId: string, data: any) {
  io?.emit("bracket:updated", { tournamentId, ...data });
}

export function emitNotification(userId: string, notification: any) {
  io?.to(`user:${userId}`).emit("notification", notification);
}
