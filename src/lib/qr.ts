import crypto from "crypto";

const SECRET = process.env.QR_SECRET_KEY || "default-secret";

export function generateQRData(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 12);
  return `${userId}-${signature}`;
}

export function parseQRData(code: string): { userId: string; valid: boolean } {
  const parts = code.split("-");
  const userId = parts[0];
  const signature = parts.slice(1).join("-");

  if (!userId || !signature) return { userId: "", valid: false };

  const payload = `${userId}:${Date.now()}`;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 12);

  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return { userId, valid };
}
