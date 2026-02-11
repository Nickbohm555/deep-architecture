import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUEUE_NAMES } from "../queues";

const mocks = vi.hoisted(() => ({
  getLatestGraphId: vi.fn(),
  queueNodeExplanation: vi.fn(),
  upsertNodeExplanationTextByProject: vi.fn(),
  getNodeExplanation: vi.fn(),
  ensureQueue: vi.fn(),
  bossSend: vi.fn()
}));

vi.mock("../persistence/node-explanation-repo", () => ({
  getLatestGraphId: mocks.getLatestGraphId,
  queueNodeExplanation: mocks.queueNodeExplanation,
  upsertNodeExplanationTextByProject: mocks.upsertNodeExplanationTextByProject,
  getNodeExplanation: mocks.getNodeExplanation
}));

vi.mock("../boss", () => ({
  ensureQueue: mocks.ensureQueue,
  boss: {
    send: mocks.bossSend
  }
}));

import {
  enqueueNodeExplanation,
  getNodeExplanationDetail,
  saveNodeExplanation
} from "./node-explanations-service";

describe("node-explanations-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues explanation job and persists queued status", async () => {
    mocks.getLatestGraphId.mockResolvedValue("graph-1");
    mocks.bossSend.mockResolvedValue("job-1");

    const result = await enqueueNodeExplanation({
      projectId: "project-1",
      nodeKey: "module:auth"
    });

    expect(result.status).toBe("queued");
    expect(mocks.ensureQueue).toHaveBeenCalledWith(QUEUE_NAMES.EXPLAIN_NODE);
    expect(mocks.bossSend).toHaveBeenCalledWith(QUEUE_NAMES.EXPLAIN_NODE, {
      graphId: "graph-1",
      nodeKey: "module:auth",
      question: expect.any(String)
    });
    expect(mocks.queueNodeExplanation).toHaveBeenCalledWith({
      projectId: "project-1",
      graphId: "graph-1",
      nodeKey: "module:auth",
      question: expect.any(String),
      jobId: "job-1"
    });
  });

  it("queues explanation with caller question override", async () => {
    mocks.getLatestGraphId.mockResolvedValue("graph-1");
    mocks.bossSend.mockResolvedValue("job-2");

    await enqueueNodeExplanation({
      projectId: "project-1",
      nodeKey: "module:auth",
      question: "How does auth data move through this node?"
    });

    expect(mocks.bossSend).toHaveBeenCalledWith(QUEUE_NAMES.EXPLAIN_NODE, {
      graphId: "graph-1",
      nodeKey: "module:auth",
      question: "How does auth data move through this node?"
    });
  });

  it("rejects save when explanation is empty", async () => {
    await expect(
      saveNodeExplanation({
        projectId: "project-1",
        nodeKey: "module:auth",
        explanation: "   "
      })
    ).rejects.toThrow("Explanation cannot be empty");
  });

  it("loads explanation detail", async () => {
    mocks.getNodeExplanation.mockResolvedValue({ node_key: "module:auth" });
    const result = await getNodeExplanationDetail("project-1", "module:auth");
    expect(result).toEqual({ node_key: "module:auth" });
  });
});
