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
        className="fixed bottom-6 right-6 w-14 h-14 bg-gold text-background rounded-full shadow-xl shadow-gold/30 flex items-center justify-center hover:bg-gold-hover transition-all z-40"
        title="Mostrar QR"
      >
        <QrCode className="w-6 h-6" />
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
