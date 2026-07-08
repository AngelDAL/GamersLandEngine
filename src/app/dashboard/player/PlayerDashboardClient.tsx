"use client";

import { useState } from "react";
import { QRDrawer } from "@/components/player/QRDrawer";
import { QrCode } from "lucide-react";

type Props = {
  userId: string;
  username: string;
};

export function PlayerDashboardClient({ userId, username }: Props) {
  const [showQR, setShowQR] = useState(false);

  return (
    <>
      {/* Floating QR button */}
      <button
        onClick={() => setShowQR(true)}
        className="fixed bottom-4 left-4 w-12 h-12 bg-surface border border-border text-muted rounded-full shadow-xl flex items-center justify-center hover:text-gold hover:border-gold/30 transition-all z-40"
        title="Mostrar QR"
      >
        <QrCode className="w-5 h-5" />
      </button>

      {/* QR Drawer */}
      <QRDrawer
        userId={userId}
        username={username}
        open={showQR}
        onClose={() => setShowQR(false)}
      />
    </>
  );
}
