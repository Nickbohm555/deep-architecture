import { explainGraphNode } from "../analysis/openai";
import { explainNodeWithRag } from "../services/rag-agent-service";
import {
  getGraphContext,
  saveNodeExplanationText,
  updateNodeExplanationStatus
} from "../persistence/node-explanation-repo";

export type ExplainNodeJobData = {
  graphId: string;
  nodeKey: string;
  question: string;
};

async function fallbackExplainNode(input: {
  question: string;
  graphSummary: string | null;
  node: {
    node_key: string;
    kind: string;
    label: string;
    data: Record<string, unknown>;
  };
  incoming: Array<{ from: string; kind: string; label: string | null }>;
  outgoing: Array<{ to: string; kind: string; label: string | null }>;
}) {
  return explainGraphNode({
    graphSummary: input.graphSummary,
    node: {
      key: input.node.node_key,
      kind: input.node.kind,
      label: input.node.label,
      data: input.node.data
    },
    incoming: input.incoming,
    outgoing: input.outgoing,
    question: input.question
  });
}

export async function explainNodeJob({ graphId, nodeKey, question }: ExplainNodeJobData) {
  await updateNodeExplanationStatus({ graphId, nodeKey, status: "running" });

  try {
    const context = await getGraphContext(graphId);
    const node = context.nodes.find((candidate) => candidate.node_key === nodeKey);

    if (!node) {
      throw new Error(`Node not found in graph: ${nodeKey}`);
    }

    const incoming = context.edges
      .filter((edge) => edge.target_key === nodeKey)
      .map((edge) => ({ from: edge.source_key, kind: edge.kind, label: edge.label }));

    const outgoing = context.edges
      .filter((edge) => edge.source_key === nodeKey)
      .map((edge) => ({ to: edge.target_key, kind: edge.kind, label: edge.label }));

    const rag = await explainNodeWithRag({
      graphId,
      nodeKey,
      question,
      graphContext: context
    }).catch(() => null);

    // Prefer RAG output; fallback keeps node explain available even when retrieval/agent steps fail.
    const explanation =
      rag?.explanation ??
      (await fallbackExplainNode({
        question,
        graphSummary: context.summary,
        node,
        incoming,
        outgoing
      }));

    await saveNodeExplanationText({
      graphId,
      nodeKey,
      explanation,
      context: rag?.context ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateNodeExplanationStatus({ graphId, nodeKey, status: "failed", error: message });
    throw error;
  }
}
