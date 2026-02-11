import type {
  GraphViewEdge,
  GraphViewNode,
  ProjectDetail
} from "@/lib/projects-types";

export type GraphViewOptions = {
  collapsedNodeKeys: Set<string>;
  showCrossLinks: boolean;
  maxVisibleNodes: number;
  searchTerm?: string;
};

const KIND_ORDER: Record<string, number> = {
  system: 0,
  service: 1,
  module: 2,
  function: 3
};

type Hierarchy = {
  parentByChild: Map<string, string>;
  childrenByParent: Map<string, string[]>;
};

function normalizeKind(kind: string) {
  return kind.toLowerCase();
}

function levelOfKind(kind: string) {
  const normalized = normalizeKind(kind);
  return KIND_ORDER[normalized] ?? 2;
}

function sortKeys(keys: string[]) {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function pickParentByPrefix(candidates: string[], childKey: string) {
  if (candidates.length === 0) return null;

  const prefixed = candidates
    .filter((candidate) => childKey.startsWith(`${candidate}.`) || childKey.startsWith(`${candidate}:`))
    .sort((a, b) => b.length - a.length);

  return prefixed[0] ?? null;
}

function choosePrimaryParent(detail: ProjectDetail, childKey: string) {
  const nodesByKey = new Map(detail.nodes.map((node) => [node.node_key, node]));

  const incomingCandidates = detail.edges
    .filter((edge) => edge.target_key === childKey)
    .map((edge) => edge.source_key)
    .filter((sourceKey) => sourceKey !== childKey && nodesByKey.has(sourceKey));

  if (incomingCandidates.length > 0) {
    return (
      incomingCandidates
        .sort((a, b) => {
          const nodeA = nodesByKey.get(a);
          const nodeB = nodesByKey.get(b);

          const kindScore = (levelOfKind(nodeA?.kind ?? "") - levelOfKind(nodeB?.kind ?? "")) * 10;
          if (kindScore !== 0) return kindScore;
          return a.localeCompare(b);
        })
        .at(0) ?? null
    );
  }

  const parentCandidates = detail.nodes
    .map((node) => node.node_key)
    .filter((nodeKey) => nodeKey !== childKey);

  return pickParentByPrefix(parentCandidates, childKey);
}

function buildHierarchy(detail: ProjectDetail): Hierarchy {
  const parentByChild = new Map<string, string>();

  for (const node of detail.nodes) {
    const parent = choosePrimaryParent(detail, node.node_key);
    if (parent) {
      parentByChild.set(node.node_key, parent);
    }
  }

  const childrenByParent = new Map<string, string[]>();
  for (const [child, parent] of parentByChild.entries()) {
    const children = childrenByParent.get(parent) ?? [];
    children.push(child);
    childrenByParent.set(parent, children);
  }

  for (const [parent, children] of childrenByParent.entries()) {
    childrenByParent.set(parent, sortKeys(children));
  }

  return { parentByChild, childrenByParent };
}

function computeDepths(parentByChild: Map<string, string>) {
  const depths = new Map<string, number>();

  const visit = (nodeKey: string, stack: Set<string>): number => {
    const cached = depths.get(nodeKey);
    if (typeof cached === "number") {
      return cached;
    }

    if (stack.has(nodeKey)) {
      depths.set(nodeKey, 0);
      return 0;
    }

    const parent = parentByChild.get(nodeKey);
    if (!parent) {
      depths.set(nodeKey, 0);
      return 0;
    }

    stack.add(nodeKey);
    const depth = visit(parent, stack) + 1;
    stack.delete(nodeKey);
    depths.set(nodeKey, depth);
    return depth;
  };

  for (const nodeKey of parentByChild.keys()) {
    visit(nodeKey, new Set());
  }

  return depths;
}

function collectHiddenDescendants(start: string, childrenByParent: Map<string, string[]>) {
  const hidden = new Set<string>();
  const stack = [...(childrenByParent.get(start) ?? [])];

  while (stack.length > 0) {
    const key = stack.pop();
    if (!key || hidden.has(key)) continue;

    hidden.add(key);
    for (const child of childrenByParent.get(key) ?? []) {
      stack.push(child);
    }
  }

  return hidden;
}

function collectVisibleFromCollapse(detail: ProjectDetail, options: GraphViewOptions, hierarchy: Hierarchy) {
  const hiddenNodeKeys = new Set<string>();

  for (const collapsedNodeKey of options.collapsedNodeKeys) {
    const hidden = collectHiddenDescendants(collapsedNodeKey, hierarchy.childrenByParent);
    for (const key of hidden) {
      hiddenNodeKeys.add(key);
    }
  }

  return new Set(detail.nodes.map((node) => node.node_key).filter((nodeKey) => !hiddenNodeKeys.has(nodeKey)));
}

function buildNeighborMap(detail: ProjectDetail, baseVisibleNodeSet: Set<string>) {
  const neighbors = new Map<string, Set<string>>();

  for (const edge of detail.edges) {
    if (!baseVisibleNodeSet.has(edge.source_key) || !baseVisibleNodeSet.has(edge.target_key)) {
      continue;
    }

    const sourceNeighbors = neighbors.get(edge.source_key) ?? new Set<string>();
    sourceNeighbors.add(edge.target_key);
    neighbors.set(edge.source_key, sourceNeighbors);

    const targetNeighbors = neighbors.get(edge.target_key) ?? new Set<string>();
    targetNeighbors.add(edge.source_key);
    neighbors.set(edge.target_key, targetNeighbors);
  }

  return neighbors;
}

function collectSearchVisibility(
  detail: ProjectDetail,
  parentByChild: Map<string, string>,
  baseVisibleNodeSet: Set<string>,
  searchTerm: string
) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return baseVisibleNodeSet;

  const matched = new Set<string>();

  for (const node of detail.nodes) {
    if (!baseVisibleNodeSet.has(node.node_key)) continue;

    const haystack = `${node.node_key} ${node.label} ${node.kind}`.toLowerCase();
    if (haystack.includes(term)) {
      matched.add(node.node_key);
    }
  }

  const visible = new Set<string>(matched);
  const neighborsByNode = buildNeighborMap(detail, baseVisibleNodeSet);

  for (const nodeKey of matched) {
    let current = parentByChild.get(nodeKey);
    while (current && baseVisibleNodeSet.has(current)) {
      visible.add(current);
      current = parentByChild.get(current);
    }

    for (const neighbor of neighborsByNode.get(nodeKey) ?? []) {
      visible.add(neighbor);
    }
  }

  return visible;
}

function projectVisibleNodes(
  detail: ProjectDetail,
  filteredVisibleNodeSet: Set<string>,
  depths: Map<string, number>,
  maxVisibleNodes: number
) {
  return detail.nodes
    .filter((node) => filteredVisibleNodeSet.has(node.node_key))
    .sort((a, b) => {
      const depthDiff = (depths.get(a.node_key) ?? 0) - (depths.get(b.node_key) ?? 0);
      if (depthDiff !== 0) return depthDiff;

      const kindDiff = levelOfKind(a.kind) - levelOfKind(b.kind);
      if (kindDiff !== 0) return kindDiff;

      return a.node_key.localeCompare(b.node_key);
    })
    .slice(0, maxVisibleNodes);
}

function projectNodes(
  visibleRawNodes: ProjectDetail["nodes"],
  childrenByParent: Map<string, string[]>,
  visibleNodeSet: Set<string>,
  collapsedNodeKeys: Set<string>
): GraphViewNode[] {
  return visibleRawNodes.map((node) => {
    const children = (childrenByParent.get(node.node_key) ?? []).filter((child) => visibleNodeSet.has(child));

    const collapsed = collapsedNodeKeys.has(node.node_key);
    const toggleGlyph = children.length > 0 ? (collapsed ? "▸ " : "▾ ") : "";

    return {
      id: node.node_key,
      rawLabel: node.label,
      label: `${toggleGlyph}${node.label}`,
      kind: node.kind,
      hasChildren: children.length > 0,
      collapsed
    };
  });
}

function projectEdges(detail: ProjectDetail, visibleNodeSet: Set<string>, options: GraphViewOptions, parentByChild: Map<string, string>) {
  const hierarchyEdges: GraphViewEdge[] = [];

  for (const [child, parent] of parentByChild.entries()) {
    if (!visibleNodeSet.has(child) || !visibleNodeSet.has(parent)) continue;

    hierarchyEdges.push({
      id: `h:${parent}->${child}`,
      source: parent,
      target: child
    });
  }

  if (!options.showCrossLinks) {
    return hierarchyEdges;
  }

  const hierarchyEdgeIds = new Set(hierarchyEdges.map((edge) => `${edge.source}|${edge.target}`));
  const crossLinks: GraphViewEdge[] = detail.edges
    .filter((edge) => visibleNodeSet.has(edge.source_key) && visibleNodeSet.has(edge.target_key))
    .filter((edge) => !hierarchyEdgeIds.has(`${edge.source_key}|${edge.target_key}`))
    .map((edge, index) => ({
      id: `x:${index}:${edge.source_key}->${edge.target_key}`,
      source: edge.source_key,
      target: edge.target_key,
      label: edge.label ?? undefined,
      isCrossLink: true
    }));

  return [...hierarchyEdges, ...crossLinks];
}

function layoutByDepth(visibleRawNodes: ProjectDetail["nodes"], depths: Map<string, number>) {
  const levelBuckets = new Map<number, string[]>();

  for (const node of visibleRawNodes) {
    const level = depths.get(node.node_key) ?? 0;
    const bucket = levelBuckets.get(level) ?? [];
    bucket.push(node.node_key);
    levelBuckets.set(level, bucket);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const levelsSorted = [...levelBuckets.keys()].sort((a, b) => a - b);

  for (const level of levelsSorted) {
    const keys = sortKeys(levelBuckets.get(level) ?? []);

    keys.forEach((key, index) => {
      positions.set(key, {
        x: index * 280,
        y: level * 180
      });
    });
  }

  return positions;
}

export function buildLayeredGraphView(detail: ProjectDetail, options: GraphViewOptions) {
  const hierarchy = buildHierarchy(detail);
  const depths = computeDepths(hierarchy.parentByChild);

  const visibleFromCollapse = collectVisibleFromCollapse(detail, options, hierarchy);

  const filteredVisibleNodeSet = collectSearchVisibility(
    detail,
    hierarchy.parentByChild,
    visibleFromCollapse,
    options.searchTerm ?? ""
  );

  const visibleRawNodes = projectVisibleNodes(
    detail,
    filteredVisibleNodeSet,
    depths,
    options.maxVisibleNodes
  );

  const visibleNodeSet = new Set(visibleRawNodes.map((node) => node.node_key));

  const nodes = projectNodes(
    visibleRawNodes,
    hierarchy.childrenByParent,
    visibleNodeSet,
    options.collapsedNodeKeys
  );

  const edges = projectEdges(detail, visibleNodeSet, options, hierarchy.parentByChild);
  const positions = layoutByDepth(visibleRawNodes, depths);

  return {
    nodes,
    edges,
    positions,
    hiddenCount: detail.nodes.length - visibleRawNodes.length
  };
}
