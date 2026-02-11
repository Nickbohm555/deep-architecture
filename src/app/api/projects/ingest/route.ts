import { NextResponse } from "next/server";
import { getHttpError } from "@/server/errors";
import { enqueueIngest } from "@/server/services/projects-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";

  try {
    const result = await enqueueIngest(repoUrl);
    return NextResponse.json(result);
  } catch (error) {
    const httpError = getHttpError(error, "Failed to enqueue ingest");
    return NextResponse.json(
      { error: httpError.error, code: httpError.code },
      { status: httpError.status }
    );
  }
}
