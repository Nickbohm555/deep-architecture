import { describe, expect, it } from "vitest";
import { buildLayeredGraphView } from "./graph-view";
import type { ProjectDetail } from "./projects-types";

const detail: ProjectDetail = {
  project: {
    id: "p1",
    name: "demo",
    repo_url: "https://github.com/org/demo",
    created_at: new Date().toISOString(),
    graph_id: "g1",
    status: "ready",
    summary: "",
    graph_created_at: new Date().toISOString()
  },
  nodes: [
    { node_key: "system:app", kind: "system", label: "System", data: {} },
    { node_key: "service:api", kind: "service", label: "API", data: {} },
    { node_key: "module:auth", kind: "module", label: "Auth", data: {} },
    { node_key: "function:auth.login", kind: "function", label: "login", data: {} }
  ],
  edges: [
    {
      source_key: "system:app",
      target_key: "service:api",
      kind: "contains",
      label: null,
      data: {}
    },
    {
      source_key: "service:api",
      target_key: "module:auth",
      kind: "contains",
      label: null,
      data: {}
    },
    {
      source_key: "module:auth",
      target_key: "function:auth.login",
      kind: "contains",
      label: null,
      data: {}
    },
    {
      source_key: "function:auth.login",
      target_key: "service:api",
      kind: "calls",
      label: "callback",
      data: {}
    }
  ]
};

describe("buildLayeredGraphView", () => {
  it("hides descendants when a node is collapsed", () => {
    const graph = buildLayeredGraphView(detail, {
      collapsedNodeKeys: new Set(["service:api"]),
      showCrossLinks: false,
      maxVisibleNodes: 80,
      searchTerm: ""
    });

    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    expect(nodeIds.has("system:app")).toBe(true);
    expect(nodeIds.has("service:api")).toBe(true);
    expect(nodeIds.has("module:auth")).toBe(false);
    expect(nodeIds.has("function:auth.login")).toBe(false);
  });

  it("includes cross links only when enabled", () => {
    const hiddenNone = new Set<string>();

    const withoutCross = buildLayeredGraphView(detail, {
      collapsedNodeKeys: hiddenNone,
      showCrossLinks: false,
      maxVisibleNodes: 80,
      searchTerm: ""
    });

    const withCross = buildLayeredGraphView(detail, {
      collapsedNodeKeys: hiddenNone,
      showCrossLinks: true,
      maxVisibleNodes: 80,
      searchTerm: ""
    });

    expect(withoutCross.edges.some((edge) => edge.isCrossLink)).toBe(false);
    expect(withCross.edges.some((edge) => edge.isCrossLink)).toBe(true);
  });

  it("filters nodes with search while preserving path context", () => {
    const graph = buildLayeredGraphView(detail, {
      collapsedNodeKeys: new Set<string>(),
      showCrossLinks: true,
      maxVisibleNodes: 80,
      searchTerm: "login"
    });

    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    expect(nodeIds.has("function:auth.login")).toBe(true);
    expect(nodeIds.has("module:auth")).toBe(true);
  });
});
