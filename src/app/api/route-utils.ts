import { NextResponse } from "next/server";
import { getHttpError } from "../../server/errors";

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

export function errorJsonResponse(error: unknown, fallbackMessage: string) {
  const httpError = getHttpError(error, fallbackMessage);
  return NextResponse.json(
    { error: httpError.error, code: httpError.code },
    { status: httpError.status }
  );
}
