import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se envió ninguna imagen" }, { status: 400 });
  }

  const maxSize = parseInt(process.env.MAX_AVATAR_SIZE_MB || "2") * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "La imagen excede el tamaño máximo" }, { status: 400 });
  }

  const allowed = (process.env.ALLOWED_AVATAR_TYPES || "image/png,image/jpeg,image/webp").split(",");
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa PNG, JPG o WebP" }, { status: 400 });
  }

  const ext = file.type.split("/")[1];
  const filename = `${session.user.id}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filepath = path.join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const avatarUrl = `/uploads/${filename}`;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl });
}
