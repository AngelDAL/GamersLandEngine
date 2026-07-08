import type { Role } from "@/generated/prisma/enums";

type Permission =
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
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return hasPermission(role, permission);
}
