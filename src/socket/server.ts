import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { getToken } from "next-auth/jwt";
import { prisma } from "../lib/prisma";
import { canAccessChatRoom } from "../lib/permissions";

let io: SocketIOServer;

// Presence tracking: roomId → Set of userIds
const presenceRooms = new Map<string, Set<string>>();

type AuthedUser = { id: string; role: string };

/**
 * Valida la cookie de sesión del handshake contra el JWT de next-auth.
 * El userId SIEMPRE sale del token: el query string es editable por el cliente
 * y antes permitía suplantar identidades y leer salas ajenas.
 */
async function authenticateHandshake(
  cookieHeader: string | undefined
): Promise<AuthedUser | null> {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || !cookieHeader) return null;

  // next-auth v5 usa "authjs.session-token"; el "__Secure-" aparece en HTTPS.
  for (const cookieName of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ]) {
    try {
      const token = await getToken({
        req: { headers: { cookie: cookieHeader } },
        secret,
        cookieName,
      });
      if (token && typeof token.id === "string" && token.id) {
        return { id: token.id, role: String(token.role ?? "PLAYER") };
      }
    } catch (err) {
      // Token ilegítil o clave distinta: se intenta el siguiente nombre.
      console.error(
        "[SOCKET] Token de sesión inválido:",
        err instanceof Error ? err.message : err
      );
    }
  }
  return null;
}

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
      credentials: true,
    },
  });

  // Next compila otra copia de este módulo para las rutas API: ahí el `io`
  // local no existe y todo emit fallaba con "Socket.io not initialized".
  // globalThis es el puente entre los dos grafos de módulos.
  (globalThis as unknown as { __glIO?: SocketIOServer }).__glIO = io;

  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const user = await authenticateHandshake(cookieHeader);
    if (!user) {
      // Sin sesión válida no hay conexión: se corta antes de cualquier evento.
      return next(new Error("No autorizado"));
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user: AuthedUser = socket.data.user;
    const userId = user.id;
    socket.join(`user:${userId}`);

    // roomId original → id resuelto en BD; chat:leave debe limpiar exactamente
    // lo que chat:join unió (antes usaba el id crudo y la presencia quedaba huérfana).
    const joinedRooms = new Map<string, string>();

    const canAccess = (roomId: string): Promise<boolean> => {
      // La sala tournament:<id> solo transporta el estado de la llave, que ya
      // es público en la página: la unen los espectadores autenticados.
      if (roomId.startsWith("tournament:")) return Promise.resolve(true);
      return canAccessChatRoom(roomId, userId, user.role);
    };

    socket.on("chat:join", async (roomId: string) => {
      if (typeof roomId !== "string" || !roomId) return;
      try {
        if (!(await canAccess(roomId))) {
          socket.emit("error", {
            error: "No perteneces a esta sala de chat",
          });
          return;
        }
        const resolvedId = await resolveChatRoom(roomId);
        socket.join(resolvedId);
        if (resolvedId !== roomId) socket.join(roomId);
        joinedRooms.set(roomId, resolvedId);

        if (!presenceRooms.has(resolvedId)) presenceRooms.set(resolvedId, new Set());
        presenceRooms.get(resolvedId)!.add(userId);
        emitPresence(resolvedId);
      } catch (err) {
        console.error("[SOCKET] Error en chat:join:", err);
      }
    });

    socket.on("chat:leave", (roomId: string) => {
      if (typeof roomId !== "string" || !roomId) return;
      const resolvedId = joinedRooms.get(roomId) ?? roomId;
      socket.leave(resolvedId);
      if (resolvedId !== roomId) socket.leave(roomId);
      joinedRooms.delete(roomId);

      const users = presenceRooms.get(resolvedId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) presenceRooms.delete(resolvedId);
        else emitPresence(resolvedId);
      }
    });

    socket.on("presence:join", async (roomId: string) => {
      if (typeof roomId !== "string" || !roomId) return;
      try {
        // Salas con formato team:/match: exigen pertenencia; las llaves libres
        // solo sirven para estados efímeros de UI y no filtran datos.
        if (parseRoomId(roomId) && !(await canAccess(roomId))) {
          socket.emit("error", { error: "No perteneces a esta sala" });
          return;
        }
        // Sin socket.join, presence:users se emitía a una sala vacía y nadie
        // lo recibía.
        socket.join(roomId);
        if (!presenceRooms.has(roomId)) presenceRooms.set(roomId, new Set());
        presenceRooms.get(roomId)!.add(userId);
        emitPresence(roomId);
      } catch (err) {
        console.error("[SOCKET] Error en presence:join:", err);
      }
    });

    socket.on("presence:leave", (roomId: string) => {
      if (typeof roomId !== "string" || !roomId) return;
      socket.leave(roomId);
      const users = presenceRooms.get(roomId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) presenceRooms.delete(roomId);
        else emitPresence(roomId);
      }
    });

    socket.on("chat:message", async (data: { roomId: string; content: string; imageUrl?: string }) => {
      if (!data || typeof data.roomId !== "string" || typeof data.content !== "string") return;
      try {
        if (!(await canAccess(data.roomId))) {
          socket.emit("error", { error: "No perteneces a esta sala de chat" });
          return;
        }
        const content = data.content.trim();
        if (!content && !data.imageUrl) return;

        const resolvedId = await resolveChatRoom(data.roomId);
        const message = await prisma.chatMessage.create({
          data: {
            roomId: resolvedId,
            senderId: userId,
            content,
            ...(data.imageUrl && { imageUrl: data.imageUrl }),
          },
          include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
        });
        io.to(resolvedId).emit("chat:message", message);
        if (resolvedId !== data.roomId) io.to(data.roomId).emit("chat:message", message);
      } catch (err) {
        console.error("[SOCKET] Error en chat:message:", err);
      }
    });

    socket.on("notification:send", (data: { userId: string; title?: string; message: string; type?: string; redirectUrl?: string }) => {
      // Solo notificaciones hacia el propio usuario autenticado: emitir hacia
      // cuentas ajenas desde el navegador permitía suplantación de avisos.
      // Los avisos del sistema se generan server-side (emitNotification).
      if (!data || typeof data.userId !== "string" || data.userId !== userId) {
        socket.emit("error", {
          error: "Solo puedes notificar a tu propia cuenta",
        });
        return;
      }
      io.to(`user:${userId}`).emit("notification", {
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
      for (const [roomId, users] of presenceRooms) {
        if (users.has(userId)) {
          users.delete(userId);
          if (users.size === 0) presenceRooms.delete(roomId);
          else emitPresence(roomId);
        }
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  const shared = (globalThis as unknown as { __glIO?: SocketIOServer }).__glIO;
  const instance = shared ?? io;
  if (!instance) throw new Error("Socket.io not initialized");
  return instance;
}

export function emitBracketUpdate(
  tournamentId: string,
  data: Record<string, unknown>
) {
  // Solo a la sala del torneo: los espectadores la unen al abrir la llave.
  // El broadcast global filtraba el evento a toda la app (regla 9).
  try {
    getIO()
      .to(`tournament:${tournamentId}`)
      .emit("bracket:updated", { tournamentId, ...data });
  } catch (err) {
    // En arranques sin socket (pruebas unitarias) el emit es prescindible.
    console.error("[SOCKET] emitBracketUpdate:", err);
  }
}

export function emitNotification(
  userId: string,
  notification: Record<string, unknown>
) {
  try {
    getIO().to(`user:${userId}`).emit("notification", notification);
  } catch (err) {
    console.error("[SOCKET] emitNotification:", err);
  }
}
