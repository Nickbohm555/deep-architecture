import { answerNodeQuestionWithRag } from "../analysis/openai";
import { getGraphNodeDetails } from "../persistence/graph-node-details-repo";
import { searchRepoChunks } from "../persistence/repo-chunks-repo";

type GraphContext = {
  projectId: string;
  summary: string | null;
  nodes: Array<{
    node_key: string;
    kind: string;
    label: string;
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    source_key: string;
    target_key: string;
    kind: string;
    label: string | null;
    data: Record<string, unknown> | null;
  }>;
};

type RagChunk = {
  path: string;
  chunkIndex: number;
  content: string;
  score: number;
};

type Citation = {
  path: string;
  reason: string;
};

function buildRetrievalQuery(input: {
  question: string;
  nodeKey: string;
  nodeLabel: string;
  nodeKind: string;
}) {
  return [input.question, input.nodeLabel, input.nodeKind, input.nodeKey.replace(/[:._-]/g, " ")]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
}

function dedupeCitations(citations: Citation[]) {
  const map = new Map<string, Citation>();
  for (const citation of citations) {
    if (!map.has(citation.path)) {
      map.set(citation.path, citation);
    }
  }
  return [...map.values()];
}

function getNodeOrThrow(context: GraphContext, nodeKey: string) {
  const node = context.nodes.find((candidate) => candidate.node_key === nodeKey);
  if (!node) {
    throw new Error(`Node not found in graph: ${nodeKey}`);
  }
  return node;
}

function getNodeFlowContext(context: GraphContext, nodeKey: string) {
  return {
    incoming: context.edges
      .filter((edge) => edge.target_key === nodeKey)
      .map((edge) => ({ from: edge.source_key, kind: edge.kind, label: edge.label })),
    outgoing: context.edges
      .filter((edge) => edge.source_key === nodeKey)
      .map((edge) => ({ to: edge.target_key, kind: edge.kind, label: edge.label }))
  };
}

function toRagChunks(
  chunks: Array<{
    path: string;
    chunk_index: number;
    content: string;
    score: number;
  }>
): RagChunk[] {
  return chunks.map((chunk) => ({
    path: chunk.path,
    chunkIndex: chunk.chunk_index,
    content: chunk.content,
    score: Number(chunk.score) || 0
  }));
}

function buildStoredDetailHints(detail: Awaited<ReturnType<typeof getGraphNodeDetails>>[number] | undefined) {
  if (!detail) return "";

  return [
    "## Stored Node Internals",
    detail.details.overview ? `- Overview: ${detail.details.overview}` : "",
    detail.details.roleInFlow ? `- Role in flow: ${detail.details.roleInFlow}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCitationsMarkdown(citations: Citation[]) {
  if (citations.length === 0) return "";
  return ["## Citations", ...citations.map((citation) => `- \`${citation.path}\`: ${citation.reason}`)].join(
    "\n"
  );
}

function mergeCitations(ragCitations: Citation[], chunks: RagChunk[]) {
  return dedupeCitations([
    ...ragCitations,
    // Ensure we always surface top-ranked retrieval evidence, even if model omits it.
    ...chunks.slice(0, 3).map((chunk) => ({
      path: chunk.path,
      reason: "Retrieved as top relevant implementation context."
    }))
  ]);
}

export async function explainNodeWithRag(input: {
  graphId: string;
  nodeKey: string;
  question: string;
  graphContext: GraphContext;
}) {
  const node = getNodeOrThrow(input.graphContext, input.nodeKey);
  const { incoming, outgoing } = getNodeFlowContext(input.graphContext, input.nodeKey);

  const retrievalQuery = buildRetrievalQuery({
    question: input.question,
    nodeKey: input.nodeKey,
    nodeLabel: node.label,
    nodeKind: node.kind
  });

  const [chunks, nodeDetails] = await Promise.all([
    searchRepoChunks({
      projectId: input.graphContext.projectId,
      graphId: input.graphId,
      nodeKey: input.nodeKey,
      query: retrievalQuery,
      limit: 10
    }),
    getGraphNodeDetails(input.graphId)
  ]);
  const ragChunks = toRagChunks(chunks);

  const selectedNodeDetail = nodeDetails.find((detail) => detail.node_key === input.nodeKey);

  const rag = await answerNodeQuestionWithRag({
    question: input.question,
    node: {
      key: node.node_key,
      kind: node.kind,
      label: node.label,
      data: node.data
    },
    graphSummary: input.graphContext.summary,
    incoming,
    outgoing,
    retrievedChunks: ragChunks
  });

  const citations = mergeCitations(rag.citations, ragChunks);
  const detailHints = buildStoredDetailHints(selectedNodeDetail);
  const citationsMarkdown = buildCitationsMarkdown(citations);

  const explanation = [rag.answer, detailHints, citationsMarkdown].filter(Boolean).join("\n\n");

  return {
    explanation,
    context: {
      retrievalQuery,
      citations,
      retrieved: ragChunks.map((chunk) => ({
        path: chunk.path,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score
      }))
    }
  };
}
