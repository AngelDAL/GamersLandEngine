import type { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallback?: React.ReactNode;
};

export async function RoleGate({ children, allowedRoles, fallback = null }: Props) {
  const session = await auth();
  if (!session?.user?.role) return fallback;
  if (!allowedRoles.includes(session.user.role as Role)) return fallback;
  return <>{children}</>;
}
