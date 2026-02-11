import { describe, expect, it } from "vitest";
import { chunkFileForRag } from "./chunking";

describe("chunkFileForRag", () => {
  it("splits TypeScript files by function/class boundaries", () => {
    const chunks = chunkFileForRag(
      "src/server/demo.ts",
      [
        "export function alpha() {",
        "  return 1;",
        "}",
        "",
        "export class Beta {",
        "  run() {",
        "    return 2;",
        "  }",
        "}",
        "",
        "const gamma = () => 3;"
      ].join("\n")
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((chunk) => chunk.symbol === "alpha")).toBe(true);
    expect(chunks.some((chunk) => chunk.symbol === "Beta")).toBe(true);
  });

  it("keeps markdown as doc chunks", () => {
    const chunks = chunkFileForRag(
      "docs/guide.md",
      "# Title\n\nThis is a docs file.\n\nIt should produce docs chunks."
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.kind === "docs")).toBe(true);
  });
});
