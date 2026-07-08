"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { Trophy, X, Bell } from "lucide-react";

type SocketNotification = {
  id: string;
  type?: string;
  title?: string;
  message: string;
  redirectUrl?: string;
  timestamp?: string;
  createdAt?: string;
};

type Props = {
  userId: string;
};

const typeIcons: Record<string, typeof Trophy> = {
  team_invite: Bell,
};

export function NotificationListener({ userId }: Props) {
  const { socket } = useSocket(userId);
  const router = useRouter();
  const [notifications, setNotifications] = useState<SocketNotification[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: SocketNotification) => {
      setNotifications((prev) => [...prev, data]);
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== data.id));
      }, 8000);
    };

    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-2 sm:top-20 sm:right-4 left-2 sm:left-auto z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {notifications.map((n) => {
        const Icon = typeIcons[n.type || ""] || Trophy;
        const title = n.title || (n.type === "team_invite" ? "Invitación a equipo" : "Notificación");
        const isClickable = !!n.redirectUrl;

        return (
          <div
            key={n.id}
            onClick={() => { if (n.redirectUrl) router.push(n.redirectUrl); }}
            className={`pointer-events-auto bg-surface border border-gold/30 rounded-xl p-4 shadow-xl shadow-gold/10 animate-slide-in flex items-start gap-3 ${
              isClickable ? "cursor-pointer hover:border-gold/60" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gold">{title}</p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
              {n.redirectUrl && (
                <p className="text-[10px] text-gold mt-1 hover:underline">Ver detalles →</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotifications((prev) => prev.filter((x) => x.id !== n.id));
              }}
              className="text-muted hover:text-foreground shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
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
