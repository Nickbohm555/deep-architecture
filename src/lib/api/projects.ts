import type {
  IngestResponse,
  NodeExplanation,
  ProjectDetail,
  ProjectRow
} from "@/lib/projects-types";

async function parseJsonOrError<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await fetch("/api/projects");
  const data = await parseJsonOrError<{ projects?: ProjectRow[] }>(res);
  return data.projects ?? [];
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${projectId}`);
  return parseJsonOrError<ProjectDetail>(res);
}

export async function ingestProject(repoUrl: string): Promise<IngestResponse> {
  const res = await fetch("/api/projects/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl })
  });
  return parseJsonOrError<IngestResponse>(res);
}

export async function enqueueNodeExplanation(input: {
  projectId: string;
  nodeKey: string;
  question?: string;
}) {
  const res = await fetch(
    `/api/projects/${input.projectId}/nodes/${encodeURIComponent(input.nodeKey)}/explain`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: input.question })
    }
  );

  return parseJsonOrError<{ graphId: string; nodeKey: string; jobId: string | null; status: string }>(
    res
  );
}

export async function fetchNodeExplanation(input: {
  projectId: string;
  nodeKey: string;
}) {
  const res = await fetch(
    `/api/projects/${input.projectId}/nodes/${encodeURIComponent(input.nodeKey)}/explanation`
  );

  return parseJsonOrError<{ explanation: NodeExplanation | null }>(res);
}

export async function saveNodeExplanation(input: {
  projectId: string;
  nodeKey: string;
  explanation: string;
}) {
  const res = await fetch(
    `/api/projects/${input.projectId}/nodes/${encodeURIComponent(input.nodeKey)}/explanation`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ explanation: input.explanation })
    }
  );

  return parseJsonOrError<{
    projectId: string;
    graphId: string;
    nodeKey: string;
    status: "ready";
  }>(res);
}
