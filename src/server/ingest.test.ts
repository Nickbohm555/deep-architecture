import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupRepo, collectRepoChunks } from "./ingest";

const tempDirs: string[] = [];

async function createTempRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "deep-arch-ingest-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupRepo(dir)));
});

describe("collectRepoChunks", () => {
  it("collects chunked content from supported source files", async () => {
    const repoDir = await createTempRepo();
    const source = "export function run(){\n" + "const x = 1;\n".repeat(220) + "return x;\n}\n";
    await fs.mkdir(path.join(repoDir, "src"), { recursive: true });
    await fs.writeFile(path.join(repoDir, "src/agent.ts"), source, "utf8");
    await fs.writeFile(path.join(repoDir, "README.md"), "# Test\n", "utf8");
    await fs.writeFile(path.join(repoDir, "asset.bin"), "noop", "utf8");

    const chunks = await collectRepoChunks(repoDir, ["src/agent.ts", "README.md", "asset.bin"]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.path === "src/agent.ts")).toBe(true);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });
});
