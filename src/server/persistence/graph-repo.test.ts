import { describe, expect, it, vi } from "vitest";
import type { GraphOutput } from "../graph-schema";
import { saveGraphOutputWithClient } from "./graph-repo";

vi.mock("../db", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn()
  }
}));

function createOutput(): GraphOutput {
  return {
    summary: "A sample graph",
    nodes: [
      { key: "service:api", kind: "service", label: "API", data: {} },
      { key: "module:auth", kind: "module", label: "Auth", data: {} }
    ],
    edges: [
      {
        source: "service:api",
        target: "module:auth",
        kind: "calls",
        label: "uses",
        data: {}
      }
    ]
  };
}

describe("saveGraphOutputWithClient", () => {
  it("writes status, upserts nodes, resets edges, and inserts new edges", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const client = { query };

    await saveGraphOutputWithClient(client, "project-1", "graph-1", createOutput());

    expect(query).toHaveBeenCalledTimes(6);
    expect(query.mock.calls[0]?.[0]).toContain("UPDATE graphs SET status");
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO graph_nodes");
    expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM graph_edges");
    expect(query.mock.calls[3]?.[0]).toContain("INSERT INTO graph_edges");
    expect(query.mock.calls[4]?.[0]).toContain("DELETE FROM graph_node_details");
    expect(query.mock.calls[5]?.[0]).toContain("DELETE FROM repo_chunks");
  });

  it("still clears edges when output has none", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const client = { query };

    await saveGraphOutputWithClient(client, "project-1", "graph-2", {
      summary: "No edges",
      nodes: [],
      edges: []
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[0]).toContain("UPDATE graphs SET status");
    expect(query.mock.calls[1]?.[0]).toContain("DELETE FROM graph_edges");
    expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM graph_node_details");
    expect(query.mock.calls[3]?.[0]).toContain("DELETE FROM repo_chunks");
  });
});
