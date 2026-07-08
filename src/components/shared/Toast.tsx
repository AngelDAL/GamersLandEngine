"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";

type ToastType = "success" | "error" | "loading";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

let toastListeners: ((toast: ToastItem) => void)[] = [];

export function showToast(message: string, type: ToastType = "success") {
  const toast: ToastItem = { id: `${Date.now()}-${Math.random()}`, message, type };
  toastListeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts((prev) => {
        // Remove loading toasts when success/error arrives
        if (toast.type !== "loading") {
          return [...prev.filter((t) => t.type !== "loading"), toast];
        }
        return [...prev, toast];
      });
      if (toast.type !== "loading") {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 3000);
      }
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((h) => h !== handler); };
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-slide-in ${
            t.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : t.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-gold/10 border-gold/30 text-gold"
          }`}
        >
          {t.type === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : t.type === "success" ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          {t.type !== "loading" && (
            <button onClick={() => remove(t.id)} className="p-0.5 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
