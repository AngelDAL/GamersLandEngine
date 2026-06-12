"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, QrCode, Maximize2 } from "lucide-react";

type Props = {
  userId: string;
  username: string;
  open: boolean;
  onClose: () => void;
};

export function QRDrawer({ userId, username, open, onClose }: Props) {
  const [maximized, setMaximized] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) setAnimating(true);
  }, [open]);

  if (!open && !maximized) return null;

  // Full-screen maximized QR
  if (maximized) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fade-in"
        onClick={() => setMaximized(false)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setMaximized(false); }}
          className="absolute top-6 right-6 text-white/60 hover:text-white z-10 transition-transform hover:scale-110"
        >
          <X className="w-8 h-8" />
        </button>
        <div
          className="bg-white rounded-3xl p-8 sm:p-12 animate-scale-in shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <QRCodeSVG value={userId} size={320} level="M" />
          <p className="text-center text-gray-800 font-bold text-xl mt-4">{username}</p>
          <p className="text-center text-gray-400 text-xs mt-1">Toca fuera para cerrar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className={`relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full max-w-sm mx-0 sm:mx-4 animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-3">
            <QrCode className="w-6 h-6 text-gold" />
          </div>
          <h3 className="font-bold text-foreground text-lg">Tu código QR</h3>
          <p className="text-xs text-muted mt-0.5">Muéstraselo al organizador para registrarte</p>
        </div>

        {/* QR Code - centered */}
        <div className="flex justify-center mb-4">
          <div
            className="inline-flex flex-col items-center gap-3 p-6 bg-white rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform relative shadow-lg"
            onClick={() => setMaximized(true)}
          >
            <QRCodeSVG value={userId} size={220} level="M" />
            <p className="text-sm font-bold text-gray-800 font-mono">{username}</p>
            <div className="absolute top-3 right-3 w-7 h-7 bg-black/10 rounded-full flex items-center justify-center hover:bg-black/20 transition-colors">
              <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted text-center">
          Toca el QR para verlo más grande · ID: {userId.slice(0, 8)}...
        </p>
      </div>
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.35s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
