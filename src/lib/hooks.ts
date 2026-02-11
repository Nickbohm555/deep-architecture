"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, refresh };
}

export function useProject(projectId: string | null) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { detail, loading, refresh: load };
}

export function useIngestProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback(async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to ingest");
      }
      return data as { projectId: string; graphId: string; jobId: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { ingest, loading, error };
}

export function useGraphView(detail: ProjectDetail | null) {
  return useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };

    const nodes = detail.nodes.map((node, index) => ({
      id: node.node_key,
      data: { label: node.label },
      position: { x: (index % 3) * 260, y: Math.floor(index / 3) * 140 },
      type: "default"
    }));

    const edges = detail.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source_key,
      target: edge.target_key,
      label: edge.label ?? undefined
    }));

    return { nodes, edges };
  }, [detail]);
}
