import { NextResponse } from "next/server";
import { errorJsonResponse, readJsonObject } from "@/app/api/route-utils";
import {
  getNodeExplanationDetail,
  saveNodeExplanation
} from "@/server/services/node-explanations-service";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string; nodekey: string } }
) {
  const detail = await getNodeExplanationDetail(params.id, decodeURIComponent(params.nodekey));
  return NextResponse.json({ explanation: detail });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string; nodekey: string } }
) {
  const body = await readJsonObject(req);
  const explanation = typeof body.explanation === "string" ? body.explanation : "";

  try {
    const saved = await saveNodeExplanation({
      projectId: params.id,
      nodeKey: decodeURIComponent(params.nodekey),
      explanation
    });
    return NextResponse.json(saved);
  } catch (error) {
    return errorJsonResponse(error, "Failed to save explanation");
  }
}
