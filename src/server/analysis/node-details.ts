import type { GraphEdge, GraphNode, GraphOutput } from "../graph-schema";

export type NodeArchitectureDetail = {
  overview: string;
  roleInFlow: string;
  triggers: string[];
  inputs: string[];
  outputs: string[];
  internalFlowSteps: string[];
  keyFunctions: string[];
  keyClasses: string[];
  dependencies: string[];
  failureModes: string[];
  observability: string[];
  sourcePointers: string[];
};

export type NodeArchitectureDetailRecord = {
  nodeKey: string;
  status?: "ready" | "fallback" | "failed";
  details: NodeArchitectureDetail;
  error?: string | null;
};

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function neighbors(nodeKey: string, edges: GraphEdge[]) {
  const incoming = edges
    .filter((edge) => edge.target === nodeKey)
    .map((edge) => `${edge.source} via ${edge.kind}${edge.label ? ` (${edge.label})` : ""}`);
  const outgoing = edges
    .filter((edge) => edge.source === nodeKey)
    .map((edge) => `${edge.target} via ${edge.kind}${edge.label ? ` (${edge.label})` : ""}`);

  return { incoming: uniqueStrings(incoming), outgoing: uniqueStrings(outgoing) };
}

function buildFallbackDetail(node: GraphNode, edges: GraphEdge[]): NodeArchitectureDetail {
  const { incoming, outgoing } = neighbors(node.key, edges);

  return {
    overview: `${node.label} is modeled as a ${node.kind} runtime component.`,
    roleInFlow:
      incoming.length > 0 && outgoing.length > 0
        ? "Transforms inbound signals into downstream actions."
        : outgoing.length > 0
          ? "Produces downstream actions from internal/system triggers."
          : incoming.length > 0
            ? "Consumes inbound signals and acts as a terminal or side-effect stage."
            : "Standalone runtime actor in the current graph.",
    triggers:
      incoming.length > 0
        ? incoming
        : ["No explicit inbound trigger found in graph edges for this node."],
    inputs:
      incoming.length > 0 ? incoming : ["Input contracts not identified from graph edges."],
    outputs:
      outgoing.length > 0 ? outgoing : ["Output contracts not identified from graph edges."],
    internalFlowSteps: [
      "Receive trigger/input",
      "Apply node-specific processing",
      "Emit downstream effect or state change"
    ],
    keyFunctions: [],
    keyClasses: [],
    dependencies: [],
    failureModes: ["Upstream/downstream dependency or integration failure."],
    observability: ["Track trigger count, processing latency, and error rate."],
    sourcePointers: []
  };
}

export function buildFallbackNodeDetails(output: GraphOutput): NodeArchitectureDetailRecord[] {
  return output.nodes.map((node) => ({
    nodeKey: node.key,
    status: "fallback",
    details: buildFallbackDetail(node, output.edges)
  }));
}

export function normalizeNodeDetails(
  output: GraphOutput,
  raw: Array<Partial<NodeArchitectureDetailRecord>>
): NodeArchitectureDetailRecord[] {
  const byKey = new Map<string, NodeArchitectureDetailRecord>();
  const nodeKeys = new Set(output.nodes.map((node) => node.key));

  for (const item of raw) {
    const nodeKey = typeof item.nodeKey === "string" ? item.nodeKey.trim() : "";
    if (!nodeKey || !nodeKeys.has(nodeKey)) continue;
    const details = item.details;
    if (!details) continue;

    byKey.set(nodeKey, {
      nodeKey,
      status: item.status === "fallback" || item.status === "failed" ? item.status : "ready",
      error: typeof item.error === "string" ? item.error : null,
      details: {
        overview: details.overview?.trim() ?? "",
        roleInFlow: details.roleInFlow?.trim() ?? "",
        triggers: uniqueStrings(details.triggers ?? []),
        inputs: uniqueStrings(details.inputs ?? []),
        outputs: uniqueStrings(details.outputs ?? []),
        internalFlowSteps: uniqueStrings(details.internalFlowSteps ?? []),
        keyFunctions: uniqueStrings(details.keyFunctions ?? []),
        keyClasses: uniqueStrings(details.keyClasses ?? []),
        dependencies: uniqueStrings(details.dependencies ?? []),
        failureModes: uniqueStrings(details.failureModes ?? []),
        observability: uniqueStrings(details.observability ?? []),
        sourcePointers: uniqueStrings(details.sourcePointers ?? [])
      }
    });
  }

  return output.nodes.map((node) => {
    const existing = byKey.get(node.key);
    if (existing) {
      return existing;
    }
    return {
      nodeKey: node.key,
      status: "fallback",
      details: buildFallbackDetail(node, output.edges),
      error: null
    };
  });
}
