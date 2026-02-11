import { embedTexts, explainGraphNodeWithRagAgent } from "../analysis/openai";
import { getGraphNodeDetails } from "../persistence/graph-node-details-repo";
import {
  searchRagChunksByPaths,
  searchRagChunksKeyword,
  searchRagChunksSemantic,
  type RagChunkMatch
} from "../persistence/rag-repo";

type GraphContext = {
  summary: string | null;
  nodes: Array<{ node_key: string; kind: string; label: string; data: Record<string, unknown> }>;
  edges: Array<{
    source_key: string;
    target_key: string;
    kind: string;
    label: string | null;
    data: Record<string, unknown> | null;
  }>;
};

type RagEvidence = {
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  snippet: string;
  score: number;
  source: "semantic" | "keyword" | "focus";
};

type ResultSource = "semantic" | "keyword" | "focus";

function truncateSnippet(content: string, maxChars: number) {
  return content.length <= maxChars ? content : `${content.slice(0, maxChars)}...`;
}

function collectNodeNeighborhood(nodeKey: string, graphContext: GraphContext) {
  const related = new Set<string>([nodeKey]);

  for (const edge of graphContext.edges) {
    if (edge.source_key === nodeKey) {
      related.add(edge.target_key);
    }
    if (edge.target_key === nodeKey) {
      related.add(edge.source_key);
    }
  }

  return [...related];
}

export function extractSourcePaths(sourcePointers: string[]) {
  const paths = new Set<string>();

  for (const pointer of sourcePointers) {
    const match = pointer.match(/[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|sql|md|json|yml|yaml)/);
    if (match?.[0]) {
      paths.add(match[0]);
    }
  }

  return [...paths];
}

export function fuseRagMatches(
  items: Array<{ source: ResultSource; rows: RagChunkMatch[] }>,
  limit: number
) {
  const RRF_K = 60;
  const aggregate = new Map<string, RagChunkMatch & { fused: number; sources: Set<ResultSource> }>();

  for (const item of items) {
    item.rows.forEach((row, rankIndex) => {
      const existing = aggregate.get(row.id);
      const score = 1 / (RRF_K + rankIndex + 1);

      if (existing) {
        existing.fused += score;
        existing.sources.add(item.source);
        return;
      }

      aggregate.set(row.id, {
        ...row,
        fused: score,
        sources: new Set([item.source])
      });
    });
  }

  return [...aggregate.values()]
    .sort((a, b) => b.fused - a.fused)
    .slice(0, limit)
    .map((row): RagChunkMatch & { source: ResultSource } => {
      const source: ResultSource = row.sources.has("focus")
        ? "focus"
        : row.sources.has("semantic")
          ? "semantic"
          : "keyword";

      return {
        ...row,
        source
      };
    });
}

async function getFocusedPaths(graphId: string, nodeKeys: string[]) {
  const details = await getGraphNodeDetails(graphId);

  const sourcePointers = details
    .filter((item) => nodeKeys.includes(item.node_key))
    .flatMap((item) => item.details.sourcePointers ?? []);

  return extractSourcePaths(sourcePointers).slice(0, 20);
}

export async function explainNodeWithRag(input: {
  graphId: string;
  nodeKey: string;
  question: string;
  graphContext: GraphContext;
}) {
  const targetNode = input.graphContext.nodes.find((node) => node.node_key === input.nodeKey);
  if (!targetNode) {
    return null;
  }

  const [queryEmbedding] = await embedTexts({
    texts: [
      [
        `Node: ${targetNode.node_key}`,
        `Kind: ${targetNode.kind}`,
        `Label: ${targetNode.label}`,
        `Question: ${input.question}`
      ].join("\n")
    ]
  });

  const neighborhood = collectNodeNeighborhood(input.nodeKey, input.graphContext);
  const focusPaths = await getFocusedPaths(input.graphId, neighborhood);

  const [semantic, keyword, focused] = await Promise.all([
    searchRagChunksSemantic({ graphId: input.graphId, queryEmbedding, limit: 30 }),
    searchRagChunksKeyword({ graphId: input.graphId, query: input.question, limit: 30 }).catch(() => []),
    searchRagChunksByPaths({ graphId: input.graphId, paths: focusPaths, limit: 20 })
  ]);

  const fused = fuseRagMatches(
    [
      { source: "semantic", rows: semantic },
      { source: "keyword", rows: keyword },
      { source: "focus", rows: focused }
    ],
    12
  );

  if (fused.length === 0) {
    return null;
  }

  const incoming = input.graphContext.edges
    .filter((edge) => edge.target_key === input.nodeKey)
    .map((edge) => ({ from: edge.source_key, kind: edge.kind, label: edge.label }));

  const outgoing = input.graphContext.edges
    .filter((edge) => edge.source_key === input.nodeKey)
    .map((edge) => ({ to: edge.target_key, kind: edge.kind, label: edge.label }));

  const evidence: RagEvidence[] = fused.map((item) => ({
    path: item.path,
    startLine: item.start_line,
    endLine: item.end_line,
    symbol: item.symbol,
    snippet: truncateSnippet(item.content, 900),
    score: item.score,
    source: item.source
  }));

  return explainGraphNodeWithRagAgent({
    graphSummary: input.graphContext.summary,
    node: {
      key: targetNode.node_key,
      kind: targetNode.kind,
      label: targetNode.label,
      data: targetNode.data
    },
    incoming,
    outgoing,
    question: input.question,
    evidence
  });
}
