import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  const content = "89467a42-7a63-4845-85d5-3a40c92e2c08";

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
