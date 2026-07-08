import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";

let io: SocketIOServer;

// Presence tracking: roomId → Set of userIds
const presenceRooms = new Map<string, Set<string>>();

function parseRoomId(roomId: string): { type: string; id: string } | null {
  if (roomId.startsWith("team:")) return { type: "team", id: roomId.slice(5) };
  if (roomId.startsWith("match:")) return { type: "match", id: roomId.slice(6) };
  return null;
}

async function resolveChatRoom(roomId: string): Promise<string> {
  const parsed = parseRoomId(roomId);
  if (!parsed) return roomId;
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

function emitPresence(roomId: string) {
  const users = presenceRooms.get(roomId);
  if (users) {
    io.to(roomId).emit("presence:users", Array.from(users));
  }
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
    if (userId) socket.join(`user:${userId}`);

    socket.on("chat:join", async (roomId: string) => {
      const resolvedId = await resolveChatRoom(roomId);
      socket.join(resolvedId);
      if (resolvedId !== roomId) socket.join(roomId);

      // Track presence
      if (userId) {
        if (!presenceRooms.has(resolvedId)) presenceRooms.set(resolvedId, new Set());
        presenceRooms.get(resolvedId)!.add(userId);
        emitPresence(resolvedId);
      }
    });

    socket.on("chat:leave", (roomId: string) => {
      socket.leave(roomId);
      // Untrack presence
      if (userId) {
        const users = presenceRooms.get(roomId);
        if (users) {
          users.delete(userId);
          if (users.size === 0) presenceRooms.delete(roomId);
          else emitPresence(roomId);
        }
      }
    });

    socket.on("presence:join", (roomId: string) => {
      if (userId) {
        if (!presenceRooms.has(roomId)) presenceRooms.set(roomId, new Set());
        presenceRooms.get(roomId)!.add(userId);
        emitPresence(roomId);
      }
    });

    socket.on("presence:leave", (roomId: string) => {
      if (userId) {
        const users = presenceRooms.get(roomId);
        if (users) {
          users.delete(userId);
          if (users.size === 0) presenceRooms.delete(roomId);
          else emitPresence(roomId);
        }
      }
    });

    socket.on("chat:message", async (data: { roomId: string; content: string; imageUrl?: string }) => {
      if (!userId) return;
      const resolvedId = await resolveChatRoom(data.roomId);
      const roomIdToUse = resolvedId || data.roomId;
      const messageData: any = {
        roomId: roomIdToUse,
        senderId: userId,
        content: data.content,
        ...(data.imageUrl && { imageUrl: data.imageUrl }),
      };
      const message = await prisma.chatMessage.create({
        data: messageData,
        include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
      });
      io.to(resolvedId).emit("chat:message", message);
    });

    socket.on("notification:send", (data: { userId: string; title?: string; message: string; type?: string; redirectUrl?: string }) => {
      io.to(`user:${data.userId}`).emit("notification", {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: data.type || "info",
        title: data.title || "Notificación",
        message: data.message,
        redirectUrl: data.redirectUrl || null,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });

    socket.on("disconnect", () => {
      // Remove from all presence rooms
      if (userId) {
        for (const [roomId, users] of presenceRooms) {
          if (users.has(userId)) {
            users.delete(userId);
            if (users.size === 0) presenceRooms.delete(roomId);
            else emitPresence(roomId);
          }
        }
      }
    });
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
