"use client";

import { useState, useEffect } from "react";

type Props = {
  scheduledAt: string | null;
  status: string;
  location?: string | null;
  large?: boolean;
};

export function MatchCountdown({ scheduledAt, status, location, large }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), large ? 1000 : 30000);
    return () => clearInterval(timer);
  }, [large]);

  if (status === "COMPLETED") return null;
  if (!scheduledAt) return null;

  const date = new Date(scheduledAt);
  const diff = date.getTime() - now;
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / 3600000);
  const minutes = Math.floor((absDiff % 3600000) / 60000);
  const seconds = Math.floor((absDiff % 60000) / 1000);

  const formatDate = date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  const formatTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const sizeClass = large ? "text-base" : "text-[10px]";

  if (isPast) {
    if (status === "IN_PROGRESS") {
      return <div className={`${sizeClass} text-green-400 flex items-center gap-1 flex-wrap font-bold`}><span>⚔️ En juego</span></div>;
    } else if (status === "PENDING") {
      return <div className={`${sizeClass} text-red-400 flex items-center gap-1 flex-wrap font-bold`}><span>🔴 ATRASADO {hours > 0 ? `${hours}h ` : ""}{minutes}min</span></div>;
    }
    return null;
  }

  // Future
  if (large) {
    // Big countdown display
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-2xl sm:text-3xl font-black text-gold tabular-nums">
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

  if (hours > 0) {
    return <div className={`${sizeClass} text-muted flex items-center gap-1 flex-wrap`}><span>🕐 {formatDate} {formatTime}</span></div>;
  } else if (minutes > 10) {
    return <div className={`${sizeClass} text-muted flex items-center gap-1 flex-wrap`}><span>🕐 {formatDate} {formatTime} · {hours}h {minutes}min</span></div>;
  } else if (minutes > 0) {
    return <div className={`${sizeClass} text-gold font-bold flex items-center gap-1 flex-wrap`}><span>🚀 {formatDate} {formatTime} · en {minutes}min</span></div>;
  }
  return <div className={`${sizeClass} text-red-400 font-bold flex items-center gap-1 flex-wrap`}><span>🔥 Ahora</span></div>;
}
