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

// El listener puede montarse en más de un sitio (Providers + dashboard del
// jugador). Un solo "instance" primario escucha el socket y pinta los toasts
// para que nunca se dupliquen.
let activeInstances = 0;

/** Solo permite rutas internas ("/algo", nunca "//host" ni "https://…"). */
function safeInternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

export function NotificationListener({ userId }: Props) {
  const { socket } = useSocket(userId);
  const router = useRouter();
  const [isPrimary, setIsPrimary] = useState(false);
  const [notifications, setNotifications] = useState<SocketNotification[]>([]);

  useEffect(() => {
    activeInstances += 1;
    let cancel: (() => void) | undefined;
    if (activeInstances === 1) {
      // setTimeout(0): fuera del cuerpo síncrono del efecto
      const id = setTimeout(() => setIsPrimary(true), 0);
      cancel = () => clearTimeout(id);
    }
    return () => {
      cancel?.();
      activeInstances = Math.max(0, activeInstances - 1);
    };
  }, []);

  useEffect(() => {
    if (!socket || !isPrimary) return;

    const handler = (data: SocketNotification) => {
      setNotifications((prev) => [...prev, data]);
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== data.id));
      }, 8000);
    };

    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket, isPrimary]);

  if (!isPrimary || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-2 sm:top-20 sm:right-4 left-2 sm:left-auto z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {notifications.map((n) => {
        const Icon = typeIcons[n.type || ""] || Trophy;
        const title = n.title || (n.type === "team_invite" ? "Invitación a equipo" : "Notificación");
        const href = safeInternalUrl(n.redirectUrl);

        return (
          <div
            key={n.id}
            onClick={() => { if (href) router.push(href); }}
            className={`pointer-events-auto bg-surface border border-gold/30 rounded-xl p-4 shadow-xl shadow-gold/10 animate-slide-in flex items-start gap-3 ${
              href ? "cursor-pointer hover:border-gold/60" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gold">{title}</p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
              {href && (
                <p className="text-[10px] text-gold mt-1 hover:underline">Ver detalles →</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotifications((prev) => prev.filter((x) => x.id !== n.id));
              }}
              className="p-1 text-muted hover:text-foreground shrink-0"
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
