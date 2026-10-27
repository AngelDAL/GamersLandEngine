import type { Role } from "@/generated/prisma/enums";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Permission =
  | "manage:tournaments"
  | "manage:all-tournaments"
  | "register:players"
  | "manage:brackets"
  | "manage:prizes"
  | "assign:prizes"
  | "scan:qr-info"
  | "scan:qr-prizes"
  | "view:history-all"
  | "chat"
  | "upload:avatar";

// Matriz de permisos por rol. Se mantiene declarativa para que las rutas y el
// UI puedan consultar capacidades sin repetir listas de roles por todos lados.
const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    "manage:tournaments",
    "manage:all-tournaments",
    "register:players",
    "manage:brackets",
    "manage:prizes",
    "assign:prizes",
    "scan:qr-info",
    "scan:qr-prizes",
    "view:history-all",
    "chat",
    "upload:avatar",
  ],
  ORGANIZER: [
    "manage:tournaments",
    "register:players",
    "manage:brackets",
    "manage:prizes",
    "scan:qr-info",
    "view:history-all",
    "chat",
    "upload:avatar",
  ],
  SPONSOR: [
    "scan:qr-info",
    "scan:qr-prizes",
    "assign:prizes",
    "view:history-all",
  ],
  PLAYER: [
    "chat",
    "upload:avatar",
    "scan:qr-info",
  ],
  EXPOSITOR: [
    "manage:tournaments",
    "register:players",
    "manage:brackets",
    "manage:prizes",
    "scan:qr-info",
    "view:history-all",
    "chat",
    "upload:avatar",
  ],
  EJECUTIVO: [
    "manage:tournaments",
    "manage:all-tournaments",
    "register:players",
    "manage:brackets",
    "manage:prizes",
    "assign:prizes",
    "scan:qr-info",
    "scan:qr-prizes",
    "view:history-all",
    "chat",
    "upload:avatar",
  ],
};

/**
 * Devuelve la sesión activo o lanza una respuesta 401 lista para devolver.
 * Next.js captura los Response lanzados desde route handlers y los devuelve
 * tal cual, así que las rutas pueden hacer `const session = await requireAuth();`
 * sin envolver cada vez.
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return session;
}

/** true si el rol de la sesión está en la lista de roles permitidos. */
export function requireRole(session: Session, roles: Role[]): boolean {
  if (!session?.user?.role) return false;
  return roles.includes(session.user.role as Role);
}

/** Respuesta estándar 403 en español para fallos de rol/propiedad. */
export function roleForbidden(): NextResponse {
  return NextResponse.json(
    { error: "No tienes permisos para realizar esta acción" },
    { status: 403 }
  );
}

/** Consulta la matriz de permisos con la sesión actual. */
export function hasPermission(
  session: Session | null,
  permission: Permission
): boolean {
  if (!session?.user?.role) return false;
  return rolePermissions[session.user.role as Role]?.includes(permission) ?? false;
}

/**
 * Autoriza el acceso de un usuario a una sala de chat (`team:<id>` o `match:<id>`).
 * Usado por la API de mensajes y por el servidor de sockets: sin esta comprobación
 * cualquier usuario autenticado podía leer/escribir en salas ajenas.
 */
export async function canAccessChatRoom(
  roomId: string,
  userId: string,
  role: string
): Promise<boolean> {
  if (role === "ADMIN") return true;

  if (roomId.startsWith("team:")) {
    const teamId = roomId.slice(5);
    if (!teamId) return false;
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    return !!membership;
  }

  if (roomId.startsWith("match:")) {
    const matchId = roomId.slice(6);
    if (!matchId) return false;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        team1Id: true,
        team2Id: true,
        round: {
          select: {
            tournament: {
              select: {
                createdById: true,
                organizers: {
                  where: { userId },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!match) return false;

    // Creador u organizador del torneo pueden ver cualquier partido de su llave.
    if (match.round.tournament.createdById === userId) return true;
    if (match.round.tournament.organizers.length > 0) return true;

    // Participantes: miembros activos de cualquiera de los dos equipos.
    const teamIds = [match.team1Id, match.team2Id].filter(
      (t): t is string => t !== null
    );
    if (teamIds.length === 0) return false;
    const membership = await prisma.teamMember.findFirst({
      where: { userId, status: "ACTIVE", teamId: { in: teamIds } },
      select: { id: true },
    });
    return !!membership;
  }

  // Formatos de sala no reconocidos se deniegan por defecto.
  return false;
}
