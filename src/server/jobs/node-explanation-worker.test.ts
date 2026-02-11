import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  explainGraphNode: vi.fn(),
  explainNodeWithRag: vi.fn(),
  getGraphContext: vi.fn(),
  saveNodeExplanationText: vi.fn(),
  updateNodeExplanationStatus: vi.fn()
}));

vi.mock("../analysis/openai", () => ({
  explainGraphNode: mocks.explainGraphNode
}));

vi.mock("../services/rag-agent-service", () => ({
  explainNodeWithRag: mocks.explainNodeWithRag
}));

vi.mock("../persistence/node-explanation-repo", () => ({
  getGraphContext: mocks.getGraphContext,
  saveNodeExplanationText: mocks.saveNodeExplanationText,
  updateNodeExplanationStatus: mocks.updateNodeExplanationStatus
}));

import { explainNodeJob } from "./node-explanation-worker";

describe("node-explanation-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getGraphContext.mockResolvedValue({
      summary: "summary",
      nodes: [{ node_key: "service:api", kind: "service", label: "API", data: {} }],
      edges: []
    });
  });

  it("uses rag answer when available", async () => {
    mocks.explainNodeWithRag.mockResolvedValue("rag explanation");

    await explainNodeJob({ graphId: "g1", nodeKey: "service:api", question: "how" });

    expect(mocks.explainNodeWithRag).toHaveBeenCalledTimes(1);
    expect(mocks.explainGraphNode).not.toHaveBeenCalled();
    expect(mocks.saveNodeExplanationText).toHaveBeenCalledWith({
      graphId: "g1",
      nodeKey: "service:api",
      explanation: "rag explanation"
    });
  });

  it("falls back to direct explain when rag returns null", async () => {
    mocks.explainNodeWithRag.mockResolvedValue(null);
    mocks.explainGraphNode.mockResolvedValue("fallback explanation");

    await explainNodeJob({ graphId: "g1", nodeKey: "service:api", question: "how" });

    expect(mocks.explainGraphNode).toHaveBeenCalledTimes(1);
    expect(mocks.saveNodeExplanationText).toHaveBeenCalledWith({
      graphId: "g1",
      nodeKey: "service:api",
      explanation: "fallback explanation"
    });
  });

  it("falls back to direct explain when rag throws", async () => {
    mocks.explainNodeWithRag.mockRejectedValue(new Error("rag unavailable"));
    mocks.explainGraphNode.mockResolvedValue("fallback explanation");

    await explainNodeJob({ graphId: "g1", nodeKey: "service:api", question: "how" });

    expect(mocks.explainGraphNode).toHaveBeenCalledTimes(1);
    expect(mocks.saveNodeExplanationText).toHaveBeenCalledWith({
      graphId: "g1",
      nodeKey: "service:api",
      explanation: "fallback explanation"
    });
  });

  it("sets failed status when node is not found", async () => {
    mocks.getGraphContext.mockResolvedValue({ summary: null, nodes: [], edges: [] });

    await expect(
      explainNodeJob({ graphId: "g1", nodeKey: "missing", question: "how" })
    ).rejects.toThrow("Node not found in graph: missing");

    expect(mocks.updateNodeExplanationStatus).toHaveBeenCalledWith({
      graphId: "g1",
      nodeKey: "missing",
      status: "failed",
      error: "Node not found in graph: missing"
    });
  });
});
