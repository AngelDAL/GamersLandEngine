"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export function QRScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<any>(null);
  const startedRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then((mod) => {
      if (cancelled) return;
      const Html5Qrcode = mod.Html5Qrcode;
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {}
        )
        .then(() => {
          startedRef.current = true;
        })
        .catch(() => {
          if (!cancelled) setError("No se pudo acceder a la cámara. Usa la búsqueda por username.");
        });
    });

    return () => {
      cancelled = true;
      if (scannerRef.current && startedRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 max-w-sm w-full relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-muted hover:text-foreground z-10">
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-bold text-gold text-sm mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Escanear código QR
        </h3>

        <div className="bg-background rounded-xl overflow-hidden mb-3" id="qr-reader" />

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {!error && (
          <p className="text-xs text-muted text-center mt-2">
            Coloca el código QR del jugador frente a la cámara
          </p>
        )}
      </div>
    </div>
  );
}
