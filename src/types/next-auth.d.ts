import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      avatarUrl: string | null;
      email?: string | null;
    };
  }

  interface User {
    role: string;
    avatarUrl: string | null;
    email?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    avatarUrl: string | null;
    email?: string | null;
  }
}
