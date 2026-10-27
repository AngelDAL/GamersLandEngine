/**
 * GET /api/riot/codes/[code]  (ADMIN u ORGANIZER)
 *
 * Devuelve la configuración de un código de torneo según Riot
 * (mapa, tipo de selección, tamaño de equipo, torneo asociado).
 * Público: no — requiere sesión con rol ADMIN u ORGANIZER.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { riotService } from "@/lib/riot-service";
import { riotErrorResponse } from "../../_shared";

const codeParamSchema = z.string().trim().min(1, "Falta el código de torneo.");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "ORGANIZER") {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { code } = await params;
    const parsed = codeParamSchema.safeParse(code);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Código inválido." },
        { status: 400 },
      );
    }

    const codeInfo = await riotService.getCodeInfo(parsed.data);
    return NextResponse.json(codeInfo);
  } catch (error) {
    return riotErrorResponse(error, "consultar código");
  }
}
