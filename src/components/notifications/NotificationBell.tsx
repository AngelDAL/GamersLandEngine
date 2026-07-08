"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, BellDot, Check, X, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  matchId: string | null;
  redirectUrl: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    setLoading(true);
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  if (!session?.user) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 text-muted hover:text-gold transition-colors">
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-2xl z-50 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">Notificaciones</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={loading} className="text-[10px] text-gold hover:underline flex items-center gap-1">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {loading ? "..." : "Todo leído"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted">Sin notificaciones</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 hover:bg-background/50 transition-colors ${n.read ? "" : "bg-gold/5"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted mt-0.5">{n.message}</p>
                      <p className="text-[9px] text-muted mt-1">{new Date(n.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!n.read && (
                        <button onClick={() => markRead(n.id)} className="p-0.5 text-muted hover:text-green-400 transition-colors">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      {n.redirectUrl && (
                        <Link href={n.redirectUrl} className="p-0.5 text-muted hover:text-gold transition-colors" title="Ver">
                          →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
