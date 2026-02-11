import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/errors";
import { errorJsonResponse, readJsonObject } from "./route-utils";

describe("readJsonObject", () => {
  it("returns parsed object when request body is a JSON object", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ repoUrl: "https://github.com/org/repo" }),
      headers: { "content-type": "application/json" }
    });

    await expect(readJsonObject(request)).resolves.toEqual({
      repoUrl: "https://github.com/org/repo"
    });
  });

  it("returns empty object when body is invalid json", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{nope",
      headers: { "content-type": "application/json" }
    });

    await expect(readJsonObject(request)).resolves.toEqual({});
  });

  it("returns empty object for non-object json payload", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify(["not", "an", "object"]),
      headers: { "content-type": "application/json" }
    });

    await expect(readJsonObject(request)).resolves.toEqual({});
  });
});

describe("errorJsonResponse", () => {
  it("maps app errors to expected status and payload", async () => {
    const response = errorJsonResponse(
      new ValidationError("Only GitHub URLs are supported", "unsupported_repo_url"),
      "Fallback"
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only GitHub URLs are supported",
      code: "unsupported_repo_url"
    });
  });

  it("maps unknown errors to internal server error", async () => {
    const response = errorJsonResponse(new Error("boom"), "Failed");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed",
      code: "internal_error"
    });
  });
});
