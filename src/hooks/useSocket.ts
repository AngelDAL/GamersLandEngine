"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

/**
 * Hook de socket en vivo.
 *
 * - Conecta a same-origin por defecto (el proxy de Next sirve el socket
 *   server); `NEXT_PUBLIC_SOCKET_URL` solo sirve para apuntar a otro host.
 * - Mantiene un registro de salas activas (`joinRoom`) y las re-emite en
 *   cada `connect`: si hay un blip de red y el socket se reconecta, el
 *   cliente vuelve a entrar a todas las salas y la UI no queda muda.
 */
export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const roomsRef = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
      query: { userId },
    });

    const joinActiveRooms = () => {
      for (const roomId of roomsRef.current) {
        s.emit("chat:join", roomId);
        s.emit("presence:join", roomId);
      }
    };

    s.on("connect", () => {
      setConnected(true);
      joinActiveRooms();
    });
    s.on("disconnect", () => setConnected(false));

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  const joinRoom = useCallback((roomId: string) => {
    roomsRef.current.add(roomId);
    const s = socketRef.current;
    if (s?.connected) {
      s.emit("chat:join", roomId);
      s.emit("presence:join", roomId);
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    roomsRef.current.delete(roomId);
    socketRef.current?.emit("chat:leave", roomId);
  }, []);

  return { socket, connected, joinRoom, leaveRoom };
}
