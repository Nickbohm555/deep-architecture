export const QUEUE_NAMES = {
  INGEST_REPO: "ingest-repo",
  EXPLAIN_NODE: "explain-node",
  RAG_INDEX: "rag-index"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
