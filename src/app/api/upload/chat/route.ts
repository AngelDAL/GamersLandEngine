import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";

// 5 MB para imágenes de chat. Sin GIF: solo PNG, JPG y WebP reales.
const MAX_SIZE = 5 * 1024 * 1024;
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
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se envió ninguna imagen" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "La imagen excede el tamaño máximo de 5 MB" },
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

  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(uploadDir, { recursive: true });

  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({ imageUrl: `/uploads/chat/${filename}` });
}
