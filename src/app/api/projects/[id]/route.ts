import { NextResponse } from "next/server";
import { getProjectDetail } from "@/server/services/projects-service";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const detail = await getProjectDetail(params.id);

  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
