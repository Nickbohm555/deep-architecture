export type ProjectRow = {
  id: string;
  name: string;
  repo_url: string;
  created_at: string;
  graph_id: string | null;
  status: string | null;
  summary: string | null;
  graph_created_at: string | null;
};

export type ProjectDetail = {
  project: ProjectRow & { metadata?: Record<string, unknown> | null };
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

export type IngestResponse = {
  projectId: string;
  graphId: string;
  jobId: string | null;
};

export type NodeExplanation = {
  project_id: string;
  graph_id: string;
  node_key: string;
  status: "queued" | "running" | "ready" | "failed";
  question: string | null;
  explanation: string | null;
  error: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GraphViewNode = {
  id: string;
  rawLabel: string;
  label: string;
  kind: string;
  hasChildren: boolean;
  collapsed: boolean;
};

export type GraphViewEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  isCrossLink?: boolean;
};
