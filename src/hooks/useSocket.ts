"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      query: { userId },
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  return { socket: socketRef.current, connected };
}
