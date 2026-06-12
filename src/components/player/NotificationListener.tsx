"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Trophy, X } from "lucide-react";

type Notification = {
  id: string;
  message: string;
  timestamp: string;
};

type Props = {
  userId: string;
};

export function NotificationListener({ userId }: Props) {
  const { socket } = useSocket(userId);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: Notification) => {
      setNotifications((prev) => [...prev, data]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== data.id));
      }, 5000);
    };

    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="bg-surface border border-gold/30 rounded-xl p-4 shadow-xl shadow-gold/10 animate-slide-in flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
            <Trophy className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gold">Registro confirmado</p>
            <p className="text-xs text-muted mt-0.5">{n.message}</p>
          </div>
          <button
            onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}
            className="text-muted hover:text-foreground shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
