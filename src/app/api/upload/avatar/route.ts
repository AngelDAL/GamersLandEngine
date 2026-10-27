import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";

// Límites duros: 2 MB para avatar. Formatos: solo PNG, JPG y WebP reales.
const MAX_SIZE = 2 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const SHARP_FORMAT: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

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

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "La imagen excede el tamaño máximo de 2 MB" },
      { status: 413 }
    );
  }

  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa PNG, JPG o WebP" },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Verificar que los bytes sean una imagen real del MIME declarado: un .txt
  // renombrado a .png pasa el chequeo de extensión pero no este.
  try {
    const meta = await sharp(buffer).metadata();
    const actual = SHARP_FORMAT[meta.format ?? ""];
    if (!actual || actual !== file.type) {
      return NextResponse.json(
        { error: "El archivo no es una imagen válida" },
        { status: 415 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "El archivo no es una imagen válida" },
      { status: 415 }
    );
  }

  // uuid + ext fija: jamás se usa el nombre del cliente (evita ../ y colisiones).
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filepath = path.join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, buffer);

  const avatarUrl = `/uploads/${filename}`;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl });
}
