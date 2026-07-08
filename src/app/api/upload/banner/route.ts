import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, readdir } from "fs/promises";
import path from "path";

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

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "La imagen excede el tamaño máximo (5MB)" }, { status: 400 });
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa PNG, JPG, WebP, GIF o SVG" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const filename = `tournament-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "banners", "uploads");
  const filepath = path.join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
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
  } catch {}

  const defaultBanners = [
    { url: "/banners/lol.svg", label: "League of Legends" },
    { url: "/banners/valorant.svg", label: "Valorant" },
    { url: "/banners/fortnite.svg", label: "Fortnite" },
    { url: "/banners/lol1v1.svg", label: "LoL 1v1" },
    { url: "/banners/default.svg", label: "Default" },
  ];

  const uploaded = uploadedFiles.map((f) => ({
    url: `/banners/uploads/${f}`,
    label: f.replace(/\.\w+$/, "").replace(/-/g, " "),
  }));

  return NextResponse.json({ defaultBanners, uploaded });
}
