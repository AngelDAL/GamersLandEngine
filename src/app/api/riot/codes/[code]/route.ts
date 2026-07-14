import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { riotService } from "@/lib/riot-service";

export async function GET(
  req: Request,
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

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json(
        { error: "code parameter is required" },
        { status: 400 },
      );
    }

    const codeInfo = await riotService.getCodeInfo(code);

    return NextResponse.json(codeInfo);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error retrieving code info";
    console.error("[API] GET /api/riot/codes/[code] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
