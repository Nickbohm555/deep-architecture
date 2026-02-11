import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  embedTexts: vi.fn(),
  explainGraphNodeWithRagAgent: vi.fn(),
  getGraphNodeDetails: vi.fn(),
  searchRagChunksSemantic: vi.fn(),
  searchRagChunksKeyword: vi.fn(),
  searchRagChunksByPaths: vi.fn()
}));

vi.mock("../analysis/openai", () => ({
  embedTexts: mocks.embedTexts,
  explainGraphNodeWithRagAgent: mocks.explainGraphNodeWithRagAgent
}));

vi.mock("../persistence/graph-node-details-repo", () => ({
  getGraphNodeDetails: mocks.getGraphNodeDetails
}));

vi.mock("../persistence/rag-repo", () => ({
  searchRagChunksSemantic: mocks.searchRagChunksSemantic,
  searchRagChunksKeyword: mocks.searchRagChunksKeyword,
  searchRagChunksByPaths: mocks.searchRagChunksByPaths
}));

import { explainNodeWithRag, extractSourcePaths, fuseRagMatches } from "./rag-agent-service";

describe("rag-agent-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts source paths from node detail source pointers", () => {
    const paths = extractSourcePaths([
      "src/server/jobs/node-explanation-worker.ts#L1",
      "function handler in src/app/api/projects/ingest/route.ts",
      "invalid pointer"
    ]);

    expect(paths).toContain("src/server/jobs/node-explanation-worker.ts");
    expect(paths).toContain("src/app/api/projects/ingest/route.ts");
    expect(paths).toHaveLength(2);
  });

  it("fuses retrieval lists with RRF and prioritizes focus source", () => {
    const fused = fuseRagMatches(
      [
        {
          source: "semantic",
          rows: [
            {
              id: "a",
              path: "src/a.ts",
              symbol: null,
              kind: "code",
              start_line: 1,
              end_line: 20,
              content: "A",
              metadata: {},
              score: 0.9
            }
          ]
        },
        {
          source: "focus",
          rows: [
            {
              id: "a",
              path: "src/a.ts",
              symbol: null,
              kind: "code",
              start_line: 1,
              end_line: 20,
              content: "A",
              metadata: {},
              score: 1
            }
          ]
        }
      ],
      5
    );

    expect(fused).toHaveLength(1);
    expect(fused[0]?.source).toBe("focus");
  });

  it("returns null when node is missing", async () => {
    const result = await explainNodeWithRag({
      graphId: "g1",
      nodeKey: "missing",
      question: "what does this node do",
      graphContext: {
        summary: null,
        nodes: [],
        edges: []
      }
    });

    expect(result).toBeNull();
    expect(mocks.embedTexts).not.toHaveBeenCalled();
  });

  it("returns rag explanation with fused evidence", async () => {
    mocks.embedTexts.mockResolvedValue([[0.1, 0.2]]);
    mocks.getGraphNodeDetails.mockResolvedValue([
      {
        node_key: "service:api",
        details: { sourcePointers: ["src/server/services/projects-service.ts"] }
      }
    ]);

    mocks.searchRagChunksSemantic.mockResolvedValue([
      {
        id: "sem-1",
        path: "src/server/services/projects-service.ts",
        symbol: "enqueueIngest",
        kind: "service",
        start_line: 1,
        end_line: 40,
        content: "semantic content",
        metadata: {},
        score: 0.8
      }
    ]);

    mocks.searchRagChunksKeyword.mockResolvedValue([
      {
        id: "kw-1",
        path: "src/app/api/projects/ingest/route.ts",
        symbol: "POST",
        kind: "api",
        start_line: 1,
        end_line: 30,
        content: "keyword content",
        metadata: {},
        score: 0.7
      }
    ]);

    mocks.searchRagChunksByPaths.mockResolvedValue([]);
    mocks.explainGraphNodeWithRagAgent.mockResolvedValue("rag answer");

    const result = await explainNodeWithRag({
      graphId: "g1",
      nodeKey: "service:api",
      question: "how does ingest run",
      graphContext: {
        summary: "graph summary",
        nodes: [
          {
            node_key: "service:api",
            kind: "service",
            label: "API",
            data: {}
          }
        ],
        edges: []
      }
    });

    expect(result).toBe("rag answer");
    expect(mocks.explainGraphNodeWithRagAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.objectContaining({ key: "service:api" }),
        evidence: expect.arrayContaining([
          expect.objectContaining({ path: "src/server/services/projects-service.ts" }),
          expect.objectContaining({ path: "src/app/api/projects/ingest/route.ts" })
        ])
      })
    );
  });

  it("returns null when retrieval has no evidence", async () => {
    mocks.embedTexts.mockResolvedValue([[0.1, 0.2]]);
    mocks.getGraphNodeDetails.mockResolvedValue([]);
    mocks.searchRagChunksSemantic.mockResolvedValue([]);
    mocks.searchRagChunksKeyword.mockResolvedValue([]);
    mocks.searchRagChunksByPaths.mockResolvedValue([]);

    const result = await explainNodeWithRag({
      graphId: "g1",
      nodeKey: "service:api",
      question: "how does ingest run",
      graphContext: {
        summary: "graph summary",
        nodes: [
          {
            node_key: "service:api",
            kind: "service",
            label: "API",
            data: {}
          }
        ],
        edges: []
      }
    });

    expect(result).toBeNull();
    expect(mocks.explainGraphNodeWithRagAgent).not.toHaveBeenCalled();
  });
});
