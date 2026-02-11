import { NextResponse } from "next/server";
import { errorJsonResponse, readJsonObject } from "@/app/api/route-utils";
import { enqueueNodeExplanation } from "@/server/services/node-explanations-service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string; nodekey: string } }
) {
  const body = await readJsonObject(req);
  const question = typeof body.question === "string" ? body.question : undefined;

  try {
    const result = await enqueueNodeExplanation({
      projectId: params.id,
      nodeKey: decodeURIComponent(params.nodekey),
      question
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorJsonResponse(error, "Failed to enqueue explanation");
  }
}
