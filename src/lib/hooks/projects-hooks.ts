"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProjectDetail, fetchProjects, ingestProject } from "@/lib/api/projects";
import type { IngestResponse, ProjectDetail, ProjectRow } from "@/lib/projects-types";

export type { IngestResponse, ProjectDetail, ProjectRow };

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjects());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}

export function useProject(projectId: string | null) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchProjectDetail(projectId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { detail, loading, error, refresh: load };
}

export function useIngestProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback(async (repoUrl: string): Promise<IngestResponse> => {
    setLoading(true);
    setError(null);

    try {
      return await ingestProject(repoUrl);
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
