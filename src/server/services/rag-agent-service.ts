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

function dedupeCitations(citations: Array<{ path: string; reason: string }>) {
  const map = new Map<string, { path: string; reason: string }>();
  for (const citation of citations) {
    if (!map.has(citation.path)) {
      map.set(citation.path, citation);
    }
  }
  return [...map.values()];
}

export async function explainNodeWithRag(input: {
  graphId: string;
  nodeKey: string;
  question: string;
  graphContext: GraphContext;
}) {
  const node = input.graphContext.nodes.find((candidate) => candidate.node_key === input.nodeKey);
  if (!node) {
    throw new Error(`Node not found in graph: ${input.nodeKey}`);
  }

  const incoming = input.graphContext.edges
    .filter((edge) => edge.target_key === input.nodeKey)
    .map((edge) => ({ from: edge.source_key, kind: edge.kind, label: edge.label }));

  const outgoing = input.graphContext.edges
    .filter((edge) => edge.source_key === input.nodeKey)
    .map((edge) => ({ to: edge.target_key, kind: edge.kind, label: edge.label }));

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
    retrievedChunks: chunks.map((chunk) => ({
      path: chunk.path,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      score: Number(chunk.score) || 0
    }))
  });

  const citations = dedupeCitations([
    ...rag.citations,
    ...chunks.slice(0, 3).map((chunk) => ({
      path: chunk.path,
      reason: "Retrieved as top relevant implementation context."
    }))
  ]);

  const detailHints = selectedNodeDetail
    ? [
        "## Stored Node Internals",
        selectedNodeDetail.details.overview ? `- Overview: ${selectedNodeDetail.details.overview}` : "",
        selectedNodeDetail.details.roleInFlow
          ? `- Role in flow: ${selectedNodeDetail.details.roleInFlow}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const citationsMarkdown =
    citations.length > 0
      ? ["## Citations", ...citations.map((citation) => `- \`${citation.path}\`: ${citation.reason}`)].join(
          "\n"
        )
      : "";

  const explanation = [rag.answer, detailHints, citationsMarkdown].filter(Boolean).join("\n\n");

  return {
    explanation,
    context: {
      retrievalQuery,
      citations,
      retrieved: chunks.map((chunk) => ({
        path: chunk.path,
        chunkIndex: chunk.chunk_index,
        score: Number(chunk.score) || 0
      }))
    }
  };
}
