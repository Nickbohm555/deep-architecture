import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  embedTexts: vi.fn(),
  cloneRepo: vi.fn(),
  cleanupRepo: vi.fn(),
  buildRagChunksFromRepo: vi.fn(),
  replaceGraphRagChunks: vi.fn()
}));

vi.mock("../analysis/openai", () => ({
  embedTexts: mocks.embedTexts
}));

vi.mock("../ingest", () => ({
  cloneRepo: mocks.cloneRepo,
  cleanupRepo: mocks.cleanupRepo
}));

vi.mock("../rag/indexing", () => ({
  buildRagChunksFromRepo: mocks.buildRagChunksFromRepo
}));

vi.mock("../persistence/rag-repo", () => ({
  replaceGraphRagChunks: mocks.replaceGraphRagChunks
}));

import { indexRepoForRagJob } from "./rag-index-worker";

describe("rag-index-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("indexes chunks with embeddings and persists them", async () => {
    mocks.buildRagChunksFromRepo.mockResolvedValue([
      {
        path: "src/a.ts",
        symbol: "a",
        kind: "code",
        startLine: 1,
        endLine: 5,
        content: "content-a",
        metadata: {},
        contentHash: "ha"
      },
      {
        path: "src/b.ts",
        symbol: "b",
        kind: "code",
        startLine: 10,
        endLine: 15,
        content: "content-b",
        metadata: {},
        contentHash: "hb"
      }
    ]);

    mocks.embedTexts.mockResolvedValueOnce([[0.1], [0.2]]);

    await indexRepoForRagJob({ repoUrl: "https://github.com/org/repo", projectId: "p1", graphId: "g1" });

    expect(mocks.cloneRepo).toHaveBeenCalledTimes(1);
    expect(mocks.replaceGraphRagChunks).toHaveBeenCalledWith(
      "g1",
      expect.arrayContaining([
        expect.objectContaining({ path: "src/a.ts", embedding: [0.1] }),
        expect.objectContaining({ path: "src/b.ts", embedding: [0.2] })
      ])
    );
    expect(mocks.cleanupRepo).toHaveBeenCalledTimes(1);
  });

  it("always cleans up workdir on failure", async () => {
    mocks.buildRagChunksFromRepo.mockRejectedValue(new Error("boom"));

    await expect(
      indexRepoForRagJob({ repoUrl: "https://github.com/org/repo", projectId: "p1", graphId: "g1" })
    ).rejects.toThrow("boom");

    expect(mocks.cleanupRepo).toHaveBeenCalledTimes(1);
  });
});
