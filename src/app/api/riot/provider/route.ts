import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { riotService } from "@/lib/riot-service";

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

    const { region, callbackUrl } = await req.json();

    if (!region || typeof region !== "string" || region.trim().length === 0) {
      return NextResponse.json(
        { error: "region is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const providerId = await riotService.createProvider(
      region.trim().toUpperCase(),
      callbackUrl?.trim(),
    );

    return NextResponse.json({ success: true, providerId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error creating provider";
    console.error("[API] POST /api/riot/provider failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
