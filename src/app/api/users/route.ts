import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

const ROLES: Role[] = ["ADMIN", "ORGANIZER", "PLAYER", "SPONSOR", "EXPOSITOR", "EJECUTIVO"];

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(20, "El usuario puede tener máximo 20 caracteres")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "El usuario solo puede contener letras, números, punto, guion bajo o guion"
    ),
  email: z
    .string()
    .trim()
    .email("Correo electrónico inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  // El rol solo lo puede elegir un ADMIN; el resto siempre crea PLAYER.
  role: z.enum(ROLES as [Role, ...Role[]], { message: "Rol no válido" }).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    if (!requireRole(session, ["ADMIN", "ORGANIZER"])) {
      return roleForbidden();
    }

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const { username, email, password, role } = parsed.data;
    // Solo ADMIN puede asignar roles distintos de PLAYER.
    const finalRole: Role =
      session.user.role === "ADMIN" && role ? role : "PLAYER";

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "El nombre de usuario ya existe" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, email: email ?? null, passwordHash, role: finalRole },
      select: { id: true, username: true, email: true, role: true, avatarUrl: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[USERS POST] Error:", err);
    return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // Listado completo con roles = solo ADMIN. Con ?q= hay modo búsqueda para
    // cualquier sesión autenticada: lo usan invitar-por-nombre (equipos) y la
    // lectura de QR en inscripciones. Devuelve como mucho 10 coincidencias.
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const role = searchParams.get("role");

    if (!q && !requireRole(session, ["ADMIN"])) {
      return roleForbidden();
    }

    const where: { role?: Role; username?: { contains: string } } = {};
    if (role && ROLES.includes(role as Role)) where.role = role as Role;

    if (q) {
      // Coincidencia exacta por id (uuid) primero
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(q)) {
        const user = await prisma.user.findUnique({
          where: { id: q },
          select: { id: true, username: true, role: true, avatarUrl: true },
        });
        if (user) {
          return NextResponse.json([user]);
        }
      }
      where.username = { contains: q };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, username: true, role: true, avatarUrl: true },
      orderBy: { username: "asc" },
      ...(q ? { take: 10 } : {}),
    });

    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[USERS GET] Error:", err);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}
