/**
 * Helpers compartidos por las rutas de `/api/riot/*` (y por
 * `/api/matches/[matchId]/code`).
 *
 * Existe para que todos los endpoints hablen igual: errores en español,
 * 429 con `Retry-After`, y un guard explícito de "modo live no configurado"
 * en lugar de un error crudo de Riot.
 */
import { NextResponse } from "next/server";
import {
  RIOT_LIVE_NOT_CONFIGURED,
  RiotApiError,
  RiotRateLimitError,
  getRiotMode,
} from "@/lib/riot-service";

/** true cuando RIOT_MODE=production (claves y límites reales de Riot). */
export function isLiveMode(): boolean {
  return getRiotMode() === "production";
}

/**
 * Guard de modo live: si falta el registro externo con Riot (provider y
 * torneo), se responde esto en lugar de dejar que Riot devuelva un error
 * crudo. En modo stub nunca se usa.
 */
export function liveNotConfigured(): NextResponse {
  return NextResponse.json({ error: RIOT_LIVE_NOT_CONFIGURED }, { status: 503 });
}

/** Traduce un error de Riot a una respuesta en español. Nunca filtra stack. */
export function riotErrorResponse(error: unknown, contexto: string): NextResponse {
  if (error instanceof RiotRateLimitError) {
    return NextResponse.json(
      { error: "Demasiadas consultas, intenta en un minuto." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  if (error instanceof RiotApiError) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: "Riot no encontró ese código de torneo." },
        { status: 404 },
      );
    }
    console.error(`[riot] ${contexto}: ${error.message}`);
    return NextResponse.json(
      { error: "Riot no respondió correctamente. Intenta de nuevo en unos minutos." },
      { status: 502 },
    );
  }
  console.error(`[riot] ${contexto}:`, error);
  return NextResponse.json(
    { error: "No se pudo completar la operación con Riot." },
    { status: 500 },
  );
}
