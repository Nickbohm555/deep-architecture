"use client";

import { useMemo } from "react";
import type { Edge, Node } from "reactflow";
import { buildLayeredGraphView } from "@/lib/graph-view";
import type { GraphViewEdge, GraphViewNode, ProjectDetail } from "@/lib/projects-types";

function toReactFlowNodes(
  graphNodes: GraphViewNode[],
  positions: Map<string, { x: number; y: number }>,
  selectedNodeKey: string | null
): Node[] {
  return graphNodes.map((node) => ({
    id: node.id,
    data: { label: node.label, rawLabel: node.rawLabel, hasChildren: node.hasChildren },
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    type: "default",
    style: {
      borderRadius: 14,
      border:
        selectedNodeKey === node.id
          ? "2px solid rgba(124, 240, 193, 0.95)"
          : "1px solid rgba(255,255,255,0.18)",
      background: "rgba(11, 17, 22, 0.9)",
      color: "#ecf0f2",
      padding: 10,
      fontSize: 12,
      width: 220
    }
  }));
}

function toReactFlowEdges(graphEdges: GraphViewEdge[]): Edge[] {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.isCrossLink ?? false,
    style: edge.isCrossLink
      ? { stroke: "rgba(124,240,193,0.45)", strokeDasharray: "6 4" }
      : { stroke: "rgba(255,255,255,0.24)" }
  }));
}

export function useGraphView(
  detail: ProjectDetail | null,
  options: {
    collapsedNodeKeys: Set<string>;
    showCrossLinks: boolean;
    selectedNodeKey: string | null;
    maxVisibleNodes: number;
    searchTerm: string;
  }
) {
  return useMemo(() => {
    if (!detail) {
      return {
        nodes: [] as Node[],
        edges: [] as Edge[],
        hiddenCount: 0
      };
    }

    const graph = buildLayeredGraphView(detail, {
      collapsedNodeKeys: options.collapsedNodeKeys,
      showCrossLinks: options.showCrossLinks,
      maxVisibleNodes: options.maxVisibleNodes,
      searchTerm: options.searchTerm
    });

    return {
      nodes: toReactFlowNodes(graph.nodes, graph.positions, options.selectedNodeKey),
      edges: toReactFlowEdges(graph.edges),
      hiddenCount: graph.hiddenCount
    };
  }, [
    detail,
    options.collapsedNodeKeys,
    options.showCrossLinks,
    options.selectedNodeKey,
    options.maxVisibleNodes,
    options.searchTerm
  ]);
}
