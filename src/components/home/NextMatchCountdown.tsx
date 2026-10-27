"use client";

import { useRouter } from "next/navigation";
import { MatchCountdown } from "@/components/notifications/MatchCountdown";

/**
 * Envoltorio cliente de MatchCountdown para páginas server: al llegar a cero
 * refresca el estado del partido (router.refresh) en vez de solo contar.
 */
export function NextMatchCountdown({
  scheduledAt,
  status,
  large,
}: {
  scheduledAt: string;
  status: string;
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <MatchCountdown
      scheduledAt={scheduledAt}
      status={status}
      large={large}
      onExpire={() => router.refresh()}
    />
  );
}
