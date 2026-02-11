import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchRepoChunks: vi.fn(),
  getGraphNodeDetails: vi.fn(),
  answerNodeQuestionWithRag: vi.fn()
}));

vi.mock("../persistence/repo-chunks-repo", () => ({
  searchRepoChunks: mocks.searchRepoChunks
}));

vi.mock("../persistence/graph-node-details-repo", () => ({
  getGraphNodeDetails: mocks.getGraphNodeDetails
}));

vi.mock("../analysis/openai", () => ({
  answerNodeQuestionWithRag: mocks.answerNodeQuestionWithRag
}));

import { explainNodeWithRag } from "./rag-agent-service";

describe("rag-agent-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds rag explanation with citations and context", async () => {
    mocks.searchRepoChunks.mockResolvedValue([
      {
        path: "src/agent/runtime.ts",
        chunk_index: 0,
        language: "typescript",
        content: "export class AgentRuntime {}",
        score: 0.9
      }
    ]);
    mocks.getGraphNodeDetails.mockResolvedValue([
      {
        node_key: "service:agent-runtime",
        details: {
          overview: "Runtime orchestrates agent execution.",
          roleInFlow: "Core orchestration layer.",
          triggers: [],
          inputs: [],
          outputs: [],
          internalFlowSteps: [],
          keyFunctions: [],
          keyClasses: [],
          dependencies: [],
          failureModes: [],
          observability: [],
          sourcePointers: []
        }
      }
    ]);
    mocks.answerNodeQuestionWithRag.mockResolvedValue({
      answer: "## Node Role\nAgent runtime handles orchestration.",
      citations: [{ path: "src/agent/runtime.ts", reason: "Defines core runtime class." }]
    });

    const result = await explainNodeWithRag({
      graphId: "g1",
      nodeKey: "service:agent-runtime",
      question: "How does this runtime work?",
      graphContext: {
        projectId: "p1",
        summary: "s",
        nodes: [
          {
            node_key: "service:agent-runtime",
            kind: "service",
            label: "Agent Runtime",
            data: {}
          }
        ],
        edges: []
      }
    });

    expect(result.explanation).toContain("Node Role");
    expect(result.explanation).toContain("Stored Node Internals");
    expect(result.context.citations[0].path).toBe("src/agent/runtime.ts");
    expect(result.context.retrievalQuery).toContain("How does this runtime work?");
  });
});
