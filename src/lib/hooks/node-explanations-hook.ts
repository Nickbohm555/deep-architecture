"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enqueueNodeExplanation,
  fetchNodeExplanation,
  saveNodeExplanation
} from "@/lib/api/projects";
import type { NodeExplanation } from "@/lib/projects-types";

export type { NodeExplanation };

export function useNodeExplanation(projectId: string | null, nodeKey: string | null) {
  const [explanation, setExplanation] = useState<NodeExplanation | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const refresh = useCallback(async () => {
    if (!projectId || !nodeKey) {
      setExplanation(null);
      setDraft("");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchNodeExplanation({ projectId, nodeKey });
      setExplanation(data.explanation);
      setDraft(data.explanation?.explanation ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, nodeKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setQuestion("");
  }, [nodeKey]);

  useEffect(() => {
    if (!explanation) return;
    if (explanation.status !== "queued" && explanation.status !== "running") return;
    if (!projectId || !nodeKey) return;

    const timer = window.setInterval(() => {
      void fetchNodeExplanation({ projectId, nodeKey }).then((data) => {
        setExplanation(data.explanation);
        if (data.explanation?.status === "ready") {
          setDraft(data.explanation.explanation ?? "");
        }
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [explanation, projectId, nodeKey]);

  const ask = useCallback(async () => {
    if (!projectId || !nodeKey) return;

    setEnqueueing(true);
    setError(null);

    try {
      await enqueueNodeExplanation({
        projectId,
        nodeKey,
        question
      });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setEnqueueing(false);
    }
  }, [projectId, nodeKey, question, refresh]);

  const save = useCallback(async () => {
    if (!projectId || !nodeKey) return;

    setSaving(true);
    setError(null);

    try {
      await saveNodeExplanation({ projectId, nodeKey, explanation: draft });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [projectId, nodeKey, draft, refresh]);

  return {
    explanation,
    draft,
    setDraft,
    loading,
    saving,
    enqueueing,
    error,
    question,
    setQuestion,
    ask,
    save,
    refresh
  };
}
