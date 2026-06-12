import type { Role, Game, TournamentStatus, BracketType } from "@/generated/prisma";

export type UserSession = {
  id: string;
  username: string;
  role: Role;
  avatarUrl: string | null;
};

export type PageProps = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export type BracketMatch = {
  id: string;
  round: number;
  position: number;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: string;
};

export type TournamentFilter = {
  game?: Game;
  status?: TournamentStatus;
  search?: string;
};

export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
