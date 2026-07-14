import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { riotService, RIOT_CALLBACK_URL } from "@/lib/riot-service";

const DEFAULT_REGION = "LAN";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "ORGANIZER") {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    // Optional body — server fills defaults if missing
    let region: string = DEFAULT_REGION;
    let callbackUrl: string = RIOT_CALLBACK_URL;
    try {
      const body = await req.json();
      if (body && typeof body.region === "string" && body.region.trim()) {
        region = body.region.trim().toUpperCase();
      }
      if (body && typeof body.callbackUrl === "string" && body.callbackUrl.trim()) {
        callbackUrl = body.callbackUrl.trim();
      }
    } catch {
      // empty body is fine — use defaults
    }

    const providerId = await riotService.createProvider(region, callbackUrl);

    return NextResponse.json({ success: true, providerId, region, callbackUrl }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error creating provider";
    console.error("[API] POST /api/riot/provider failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
