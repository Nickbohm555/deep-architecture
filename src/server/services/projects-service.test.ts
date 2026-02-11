import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../errors";
import { QUEUE_NAMES } from "../queues";

const mocks = vi.hoisted(() => ({
  poolConnect: vi.fn(),
  ensureQueue: vi.fn(),
  bossSend: vi.fn(),
  listProjectsWithLatestGraph: vi.fn(),
  getProjectByIdWithLatestGraph: vi.fn(),
  getGraphNodes: vi.fn(),
  getGraphEdges: vi.fn(),
  upsertProjectByRepoUrl: vi.fn(),
  createGraph: vi.fn(),
  setProjectLatestGraph: vi.fn(),
  setGraphJobId: vi.fn()
}));

vi.mock("../db", () => ({
  pool: {
    connect: mocks.poolConnect
  }
}));

vi.mock("../boss", () => ({
  ensureQueue: mocks.ensureQueue,
  boss: {
    send: mocks.bossSend
  }
}));

vi.mock("../persistence/projects-repo", () => ({
  listProjectsWithLatestGraph: mocks.listProjectsWithLatestGraph,
  getProjectByIdWithLatestGraph: mocks.getProjectByIdWithLatestGraph,
  getGraphNodes: mocks.getGraphNodes,
  getGraphEdges: mocks.getGraphEdges,
  upsertProjectByRepoUrl: mocks.upsertProjectByRepoUrl,
  createGraph: mocks.createGraph,
  setProjectLatestGraph: mocks.setProjectLatestGraph,
  setGraphJobId: mocks.setGraphJobId
}));

import { enqueueIngest, getProjectDetail, listProjects } from "./projects-service";

describe("projects-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists projects via the repository layer", async () => {
    mocks.listProjectsWithLatestGraph.mockResolvedValue([{ id: "p1" }]);
    await expect(listProjects()).resolves.toEqual([{ id: "p1" }]);
    expect(mocks.listProjectsWithLatestGraph).toHaveBeenCalledTimes(1);
  });

  it("returns null when project is not found", async () => {
    mocks.getProjectByIdWithLatestGraph.mockResolvedValue(null);
    await expect(getProjectDetail("missing")).resolves.toBeNull();
  });

  it("returns project detail with graph nodes and edges", async () => {
    mocks.getProjectByIdWithLatestGraph.mockResolvedValue({
      id: "p1",
      graph_id: "g1"
    });
    mocks.getGraphNodes.mockResolvedValue([{ node_key: "service:api" }]);
    mocks.getGraphEdges.mockResolvedValue([{ source_key: "service:api", target_key: "db:main" }]);

    await expect(getProjectDetail("p1")).resolves.toEqual({
      project: { id: "p1", graph_id: "g1" },
      nodes: [{ node_key: "service:api" }],
      edges: [{ source_key: "service:api", target_key: "db:main" }]
    });
  });

  it("rejects unsupported repo urls", async () => {
    await expect(enqueueIngest("https://gitlab.com/org/repo")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("creates project/graph and enqueues ingest job in one transaction", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    mocks.poolConnect.mockResolvedValue({ query, release });
    mocks.upsertProjectByRepoUrl.mockResolvedValue("project-1");
    mocks.createGraph.mockResolvedValue("graph-1");
    mocks.bossSend.mockResolvedValue("job-1");

    await expect(enqueueIngest("https://github.com/org/repo")).resolves.toEqual({
      projectId: "project-1",
      graphId: "graph-1",
      jobId: "job-1"
    });

    expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mocks.upsertProjectByRepoUrl).toHaveBeenCalledTimes(1);
    expect(mocks.createGraph).toHaveBeenCalledWith(expect.anything(), "project-1", "Initial", "queued");
    expect(mocks.ensureQueue).toHaveBeenCalledWith(QUEUE_NAMES.INGEST_REPO);
    expect(mocks.bossSend).toHaveBeenCalledWith(QUEUE_NAMES.INGEST_REPO, {
      repoUrl: "https://github.com/org/repo",
      projectId: "project-1",
      graphId: "graph-1"
    });
    expect(mocks.setGraphJobId).toHaveBeenCalledWith(expect.anything(), "graph-1", "job-1");
    expect(query).toHaveBeenLastCalledWith("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });
});
