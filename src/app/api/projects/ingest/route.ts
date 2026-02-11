import { NextResponse } from "next/server";
import { errorJsonResponse, readJsonObject } from "@/app/api/route-utils";
import { enqueueIngest } from "@/server/services/projects-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJsonObject(req);
  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";

  try {
    const result = await enqueueIngest(repoUrl);
    return NextResponse.json(result);
  } catch (error) {
    return errorJsonResponse(error, "Failed to enqueue ingest");
  }
}
