"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BellDot, Check, ExternalLink, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";

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

// Solo acepta rutas internas para evitar saltos a dominios externos
function safeInternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { socket } = useSocket(session?.user?.id);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    // setTimeout(0): el fetch arranca fuera del cuerpo síncrono del efecto
    const boot = setTimeout(load, 0);
    // Respaldo del socket: refetch cada 2 minutos (nunca más seguido)
    const interval = setInterval(load, 120000);
    return () => { clearTimeout(boot); clearInterval(interval); };
  }, [session, load]);

  // Notificaciones en vivo por socket
  useEffect(() => {
    if (!socket) return;
    const handler = (data: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        return [data, ...prev].slice(0, 50);
      });
      if (!data.read) setUnreadCount((prev) => prev + 1);
    };
    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket]);

  // El menú móvil ("Más" → Notificaciones) pide abrir el dropdown
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("gamersland:focus-notifications", handler);
    return () => window.removeEventListener("gamersland:focus-notifications", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch { /* se reintenta con el próximo refetch */ }
    setLoading(false);
  };

  const markRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* el contador se corrige en el próximo refetch */ }
  };

  if (!session?.user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 min-w-10 min-h-10 flex items-center justify-center text-muted hover:text-gold transition-colors"
        aria-label="Notificaciones"
      >
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
            {fetchError && notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-muted mb-3">No pudimos cargar tus notificaciones</p>
                <button onClick={load} className="text-xs text-gold hover:underline">Reintentar</button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted">Sin notificaciones</div>
            ) : (
              notifications.map((n) => {
                const href = safeInternalUrl(n.redirectUrl);
                return (
                  <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 hover:bg-background/50 transition-colors ${n.read ? "" : "bg-gold/5"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted mt-0.5">{n.message}</p>
                        <p className="text-[9px] text-muted mt-1">{new Date(n.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {!n.read && (
                          <button onClick={() => markRead(n.id)} className="p-1.5 min-w-8 min-h-8 flex items-center justify-center text-muted hover:text-green-400 transition-colors" title="Marcar como leída">
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        {href && (
                          <Link href={href} className="p-1.5 min-w-8 min-h-8 flex items-center justify-center text-muted hover:text-gold transition-colors" title="Ver detalles">
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
