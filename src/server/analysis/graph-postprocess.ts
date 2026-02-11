import type { GraphEdge, GraphNode, GraphOutput } from "../graph-schema";

type MutableGraphOutput = {
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const MAX_NODES = 120;
const MAX_EDGES = 240;

function normalizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function normalizeNode(node: Partial<GraphNode>): GraphNode | null {
  const key = normalizeText(node.key);
  const label = normalizeText(node.label);
  const kind = normalizeText(node.kind, "module").toLowerCase() || "module";

  if (!key || !label) return null;

  return {
    key,
    kind,
    label,
    data: {}
  };
}

function normalizeEdge(edge: Partial<GraphEdge>): GraphEdge | null {
  const source = normalizeText(edge.source);
  const target = normalizeText(edge.target);
  const kind = normalizeText(edge.kind, "flow").toLowerCase() || "flow";
  const label = normalizeText(edge.label, kind || "flow");

  if (!source || !target || source === target) return null;

  return {
    source,
    target,
    kind,
    label,
    data: {}
  };
}

function dedupeNodes(nodes: GraphNode[]) {
  const map = new Map<string, GraphNode>();

  for (const node of nodes) {
    if (!map.has(node.key)) {
      map.set(node.key, node);
    }
  }

  return [...map.values()];
}

function dedupeEdges(edges: GraphEdge[]) {
  const map = new Map<string, GraphEdge>();

  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.kind}`;
    if (!map.has(key)) {
      map.set(key, edge);
    }
  }

  return [...map.values()];
}

function inferHierarchicalEdges(nodes: GraphNode[]) {
  const keys = nodes.map((node) => node.key);
  const edges: GraphEdge[] = [];

  for (const child of keys) {
    const parent = keys
      .filter((candidate) => candidate !== child)
      .filter((candidate) => child.startsWith(`${candidate}.`) || child.startsWith(`${candidate}:`))
      .sort((a, b) => b.length - a.length)[0];

    if (parent) {
      edges.push({
        source: parent,
        target: child,
        kind: "contains",
        label: "contains",
        data: {}
      });
    }
  }

  return edges;
}

function findNodeByKeyword(nodes: GraphNode[], keyword: string) {
  const key = keyword.toLowerCase();
  return nodes.find((node) => {
    const haystack = `${node.key} ${node.label} ${node.kind}`.toLowerCase();
    return haystack.includes(key);
  });
}

function inferOrderedFlowEdges(
  nodes: GraphNode[],
  steps: Array<{
    keywords: string[];
    kind: string;
    label: string;
  }>
) {
  const resolved: Array<{ node: GraphNode; kind: string; label: string }> = [];

  for (const step of steps) {
    const match = step.keywords
      .map((keyword) => findNodeByKeyword(nodes, keyword))
      .find(Boolean);

    if (!match) continue;

    if (resolved.some((item) => item.node.key === match.key)) continue;

    resolved.push({
      node: match,
      kind: step.kind,
      label: step.label
    });
  }

  const edges: GraphEdge[] = [];

  for (let index = 0; index < resolved.length - 1; index += 1) {
    const current = resolved[index];
    const next = resolved[index + 1];

    edges.push({
      source: current.node.key,
      target: next.node.key,
      kind: current.kind,
      label: current.label,
      data: {}
    });
  }

  return edges;
}

function inferCriticalFlowEdges(nodes: GraphNode[]) {
  const docker = findNodeByKeyword(nodes, "docker") ?? findNodeByKeyword(nodes, "compose");
  const gateway = findNodeByKeyword(nodes, "gateway") ?? findNodeByKeyword(nodes, "api");
  const whatsapp =
    findNodeByKeyword(nodes, "whatsapp") ??
    findNodeByKeyword(nodes, "baileys") ??
    findNodeByKeyword(nodes, "channel");
  const agent = findNodeByKeyword(nodes, "agent") ?? findNodeByKeyword(nodes, "worker");
  const output =
    findNodeByKeyword(nodes, "output") ??
    findNodeByKeyword(nodes, "send") ??
    findNodeByKeyword(nodes, "outbound") ??
    findNodeByKeyword(nodes, "response");

  const chain = [docker, gateway, whatsapp, agent, output].filter(Boolean) as GraphNode[];
  const edges: GraphEdge[] = [];

  for (let index = 0; index < chain.length - 1; index += 1) {
    edges.push({
      source: chain[index].key,
      target: chain[index + 1].key,
      kind: "flow",
      label: "flow",
      data: {}
    });
  }

  return edges;
}

function inferAgenticFlowEdges(nodes: GraphNode[]) {
  return inferOrderedFlowEdges(nodes, [
    {
      keywords: ["webhook", "http", "trigger", "gateway", "api", "ingress"],
      kind: "http",
      label: "trigger"
    },
    {
      keywords: ["orchestrator", "router", "planner", "agent", "workflow"],
      kind: "flow",
      label: "orchestrates"
    },
    {
      keywords: ["prompt", "template", "context"],
      kind: "prompt_build",
      label: "builds prompt/context"
    },
    {
      keywords: ["llm", "openai", "model", "completion", "chat"],
      kind: "llm_infer",
      label: "model inference"
    },
    {
      keywords: ["tool", "function call", "executor", "adapter", "baileys", "whatsapp"],
      kind: "tool_call",
      label: "calls tool/channel"
    },
    {
      keywords: ["retrieval", "vector", "knowledge", "rag", "search"],
      kind: "retrieval_query",
      label: "retrieves context"
    },
    {
      keywords: ["memory", "state", "session", "redis", "postgres", "db", "store"],
      kind: "memory_write",
      label: "persists state"
    },
    {
      keywords: ["output", "response", "sender", "dispatch", "emit", "outbound"],
      kind: "output_emit",
      label: "emits output"
    }
  ]);
}

function filterEdgesToKnownNodes(edges: GraphEdge[], nodeKeys: Set<string>) {
  return edges.filter((edge) => nodeKeys.has(edge.source) && nodeKeys.has(edge.target));
}

export function sanitizeGraphOutput(input: unknown): GraphOutput {
  const raw = input as Partial<MutableGraphOutput>;

  const summary = normalizeText(raw.summary, "No summary provided.");
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  let nodes = dedupeNodes(rawNodes.map((node) => normalizeNode(node)).filter(Boolean) as GraphNode[]);
  nodes = nodes.slice(0, MAX_NODES);

  const nodeKeys = new Set(nodes.map((node) => node.key));

  let edges = rawEdges.map((edge) => normalizeEdge(edge)).filter(Boolean) as GraphEdge[];
  edges = filterEdgesToKnownNodes(edges, nodeKeys);

  if (edges.length === 0) {
    edges = inferHierarchicalEdges(nodes);
  }

  if (edges.length < Math.min(4, nodes.length - 1)) {
    edges = [...edges, ...inferCriticalFlowEdges(nodes)];
  }

  if (edges.length < Math.min(6, nodes.length - 1)) {
    edges = [...edges, ...inferAgenticFlowEdges(nodes)];
  }

  edges = dedupeEdges(filterEdgesToKnownNodes(edges, nodeKeys)).slice(0, MAX_EDGES);

  return {
    summary,
    nodes,
    edges
  };
}
