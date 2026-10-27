import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, readdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";

// 4 MB para banners. Sin SVG (XSS almacenado) ni GIF: solo PNG, JPG y WebP reales.
const MAX_SIZE = 4 * 1024 * 1024;
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
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("banner") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se envió ninguna imagen" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "La imagen excede el tamaño máximo de 4 MB" },
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
  const uploadDir = path.join(process.cwd(), "public", "banners", "uploads");
  const filepath = path.join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, buffer);

  const imageUrl = `/banners/uploads/${filename}`;

  return NextResponse.json({ imageUrl });
}

export async function GET() {
  const bannersDir = path.join(process.cwd(), "public", "banners");
  let uploadedFiles: string[] = [];

  try {
    const uploadDir = path.join(bannersDir, "uploads");
    const files = await readdir(uploadDir);
    uploadedFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f));
  } catch {
    // Todavía no hay banners subidos: se responde solo con los predefinidos.
  }

  const defaultBanners = [
    { url: "/banners/lol.svg", label: "League of Legends" },
    { url: "/banners/valorant.svg", label: "Valorant" },
    { url: "/banners/fortnite.svg", label: "Fortnite" },
    { url: "/banners/lol1v1.svg", label: "LoL 1v1" },
    { url: "/banners/default.svg", label: "Default" },
    { url: "/covers/lol.jpg", label: "League of Legends (Arte)" },
    { url: "/covers/lol1v1.jpg", label: "LoL 1v1 (Arte)" },
    { url: "/covers/valorant.jpg", label: "Valorant (Arte)" },
  ];

  const uploaded = uploadedFiles.map((f) => ({
    url: `/banners/uploads/${f}`,
    label: f.replace(/\.\w+$/, "").replace(/-/g, " "),
  }));

  return NextResponse.json({ defaultBanners, uploaded });
}
