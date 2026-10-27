/**
 * Migración puntual (un solo uso): asigna contraseña temporal a los usuarios
 * que quedaron sin contraseña tras el cambio a login con contraseña.
 * El admin puede cambiarla después desde el panel.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const TEMP = process.env.TEMP_PASSWORD || "Gamers#2026x";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, passwordHash: true } });
  const pending = users.filter((u) => !u.passwordHash);
  const hash = await bcrypt.hash(TEMP, 10);
  if (pending.length) {
    await prisma.user.updateMany({
      where: { id: { in: pending.map((u) => u.id) } },
      data: { passwordHash: hash },
    });
  }
  console.log(`usuarios totales: ${users.length}`);
  console.log(`con contraseña ya puesta: ${users.length - pending.length}`);
  console.log(`asignadas ahora: ${pending.length}`);
  console.log(`nombres actualizados: ${pending.map((u) => u.username).join(", ") || "(ninguno)"}`);
}

main().finally(() => prisma.$disconnect());
