import { NextResponse } from "next/server";
import { getHttpError } from "@/server/errors";
import { enqueueNodeExplanation } from "@/server/services/node-explanations-service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string; nodekey: string } }
) {
  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question : undefined;

  try {
    const result = await enqueueNodeExplanation({
      projectId: params.id,
      nodeKey: decodeURIComponent(params.nodekey),
      question
    });
    return NextResponse.json(result);
  } catch (error) {
    const httpError = getHttpError(error, "Failed to enqueue explanation");
    return NextResponse.json(
      { error: httpError.error, code: httpError.code },
      { status: httpError.status }
    );
  }
}
