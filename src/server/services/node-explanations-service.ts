import { boss, ensureQueue } from "../boss";
import { ValidationError } from "../errors";
import { QUEUE_NAMES } from "../queues";
import {
  getLatestGraphId,
  getNodeExplanation,
  queueNodeExplanation,
  upsertNodeExplanationTextByProject
} from "../persistence/node-explanation-repo";

const DEFAULT_QUESTION =
  "Explain this node in depth and how it relates to the rest of the architecture.";

export async function getNodeExplanationDetail(projectId: string, nodeKey: string) {
  return getNodeExplanation(projectId, nodeKey);
}

export async function enqueueNodeExplanation(input: {
  projectId: string;
  nodeKey: string;
  question?: string;
}) {
  const graphId = await getLatestGraphId(input.projectId);
  if (!graphId) {
    throw new ValidationError("Project has no graph yet", "project_has_no_graph");
  }

  const question = input.question?.trim() || DEFAULT_QUESTION;

  await ensureQueue(QUEUE_NAMES.EXPLAIN_NODE);
  const jobId = await boss.send(QUEUE_NAMES.EXPLAIN_NODE, {
    graphId,
    nodeKey: input.nodeKey,
    question
  });

  await queueNodeExplanation({
    projectId: input.projectId,
    graphId,
    nodeKey: input.nodeKey,
    question,
    jobId
  });

  return { graphId, nodeKey: input.nodeKey, jobId, status: "queued" as const };
}

export async function saveNodeExplanation(input: {
  projectId: string;
  nodeKey: string;
  explanation: string;
}) {
  if (!input.explanation.trim()) {
    throw new ValidationError("Explanation cannot be empty", "empty_explanation");
  }

  const graphId = await getLatestGraphId(input.projectId);
  if (!graphId) {
    throw new ValidationError("Project has no graph yet", "project_has_no_graph");
  }

  await upsertNodeExplanationTextByProject(input);
  return {
    projectId: input.projectId,
    graphId,
    nodeKey: input.nodeKey,
    status: "ready" as const
  };
}
