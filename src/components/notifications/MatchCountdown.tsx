"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  scheduledAt: string | null;
  status: string;
  large?: boolean;
  /** Se dispara una sola vez cuando la cuenta regresiva llega a cero
   *  (para refrescar el estado del partido en vez de solo contar). */
  onExpire?: () => void;
};

export function MatchCountdown({ scheduledAt, status, large, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), large ? 1000 : 30000);
    return () => clearInterval(timer);
  }, [large]);

  // Resetea el disparador si cambia el partido programado
  useEffect(() => {
    expiredRef.current = false;
  }, [scheduledAt]);

  const isPastEarly = scheduledAt ? new Date(scheduledAt).getTime() - now < 0 : false;

  useEffect(() => {
    if (isPastEarly && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [isPastEarly]);

  if (status === "COMPLETED") return null;
  if (!scheduledAt) return null;

  const date = new Date(scheduledAt);
  const diff = date.getTime() - now;
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / 86400000);
  const hours = Math.floor((absDiff % 86400000) / 3600000);
  const minutes = Math.floor((absDiff % 3600000) / 60000);
  const seconds = Math.floor((absDiff % 60000) / 1000);

  const formatDate = date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  const formatTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const baseClass = "rounded-lg p-3 font-bold";

  if (isPast) {
    if (status === "IN_PROGRESS") {
      return (
        <div className={`${baseClass} text-green-400 bg-green-500/10 border border-green-500/30 flex items-center gap-2 text-lg`}>
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" aria-hidden />
          En vivo
        </div>
      );
    } else if (status === "PENDING") {
      return (
        <div className={`${baseClass} text-red-400 bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-lg`}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden />
          Atrasado {days > 0 ? `${days}d ` : ""}{hours > 0 ? `${hours}h ` : ""}{minutes}min
        </div>
      );
    }
    return null;
  }

  // Future
  if (large) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const showDays = days > 0;
    return (
      <div className="flex flex-col items-center gap-1 bg-gold/10 border border-gold/20 rounded-xl p-4">
        <div className="flex items-center gap-1 text-2xl sm:text-3xl font-black text-gold tabular-nums">
          {showDays && (
            <>
              <span className="text-lg text-muted">{days}d</span>
              <span className="text-muted mx-1">·</span>
            </>
          )}
          <span>{pad(hours)}</span>
          <span className="text-muted">:</span>
          <span>{pad(minutes)}</span>
          <span className="text-muted">:</span>
          <span>{pad(seconds)}</span>
        </div>
        <span className="text-xs text-muted">{formatDate} · {formatTime}</span>
      </div>
    );
  }

  if (days > 0) {
    return (
      <div className={`${baseClass} bg-gold/10 border border-gold/20 text-gold flex items-center gap-2 text-lg`}>
        <span>{days}d {hours}h · {formatDate} {formatTime}</span>
      </div>
    );
  }

  if (hours > 0) {
    return (
      <div className={`${baseClass} bg-gold/10 border border-gold/20 text-gold flex items-center gap-2 text-lg`}>
        <span>{formatDate} {formatTime}</span>
      </div>
    );
  } else if (minutes > 10) {
    return (
      <div className={`${baseClass} bg-gold/10 border border-gold/20 text-gold flex items-center gap-2 text-lg`}>
        <span>{formatDate} {formatTime} · {hours}h {minutes}min</span>
      </div>
    );
  } else if (minutes > 0) {
    return (
      <div className={`${baseClass} bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2 text-lg`}>
        <span>{formatDate} {formatTime} · en {minutes}min</span>
      </div>
    );
  }
  return (
    <div className={`${baseClass} bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2 text-lg`}>
      <span>Es ahora</span>
    </div>
  );
}
