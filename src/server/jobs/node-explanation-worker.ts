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

export async function explainNodeJob({ graphId, nodeKey, question }: ExplainNodeJobData) {
  await updateNodeExplanationStatus({ graphId, nodeKey, status: "running" });

  try {
    const context = await getGraphContext(graphId);
    const node = context.nodes.find((candidate) => candidate.node_key === nodeKey);

    if (!node) {
      throw new Error(`Node not found in graph: ${nodeKey}`);
    }

    const ragExplanation = await explainNodeWithRag({
      graphId,
      nodeKey,
      question,
      graphContext: context
    }).catch(() => null);

    const incoming = context.edges
      .filter((edge) => edge.target_key === nodeKey)
      .map((edge) => ({ from: edge.source_key, kind: edge.kind, label: edge.label }));

    const outgoing = context.edges
      .filter((edge) => edge.source_key === nodeKey)
      .map((edge) => ({ to: edge.target_key, kind: edge.kind, label: edge.label }));

    const explanation =
      ragExplanation ??
      (await explainGraphNode({
        graphSummary: context.summary,
        node: {
          key: node.node_key,
          kind: node.kind,
          label: node.label,
          data: node.data
        },
        incoming,
        outgoing,
        question
      }));

    await saveNodeExplanationText({ graphId, nodeKey, explanation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateNodeExplanationStatus({ graphId, nodeKey, status: "failed", error: message });
    throw error;
  }
}
