"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  userId: string;
  username: string;
  size?: number;
};

export function PlayerQR({ userId, username, size = 180 }: Props) {
  const qrValue = userId;

  return (
    <div className="inline-flex flex-col items-center gap-3 p-4 bg-white rounded-xl">
      <QRCodeSVG value={qrValue} size={size} level="M" />
      <p className="text-xs font-mono text-gray-800 font-bold">{username}</p>
      <p className="text-[10px] text-gray-500">ID: {userId.slice(0, 8)}...</p>
    </div>
  );
}
