"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeMouseHandler } from "reactflow";
import "reactflow/dist/style.css";
import { GraphCanvas } from "@/components/home/GraphCanvas";
import { FlowControlsPanel } from "@/components/home/FlowControlsPanel";
import { IngestPanel } from "@/components/home/IngestPanel";
import { InspectorPanels } from "@/components/home/InspectorPanels";
import { SnapshotsPanel } from "@/components/home/SnapshotsPanel";
import { TopBar } from "@/components/home/TopBar";
import {
  useGraphView,
  useIngestProject,
  useNodeExplanation,
  useProject,
  useProjects
} from "@/lib/hooks";

const MAX_VISIBLE_NODES = 80;

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [collapsedNodeKeys, setCollapsedNodeKeys] = useState<Set<string>>(new Set());
  const [showCrossLinks, setShowCrossLinks] = useState(true);
  const [nodeSearch, setNodeSearch] = useState("");
  const initializedGraphIdRef = useRef<string | null>(null);

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects
  } = useProjects();
  const { ingest, loading: ingesting, error: ingestError } = useIngestProject();
  const { detail, loading: detailLoading, error: detailError } = useProject(selectedProjectId);

  const { nodes, edges, hiddenCount } = useGraphView(detail, {
    collapsedNodeKeys,
    showCrossLinks,
    selectedNodeKey,
    maxVisibleNodes: MAX_VISIBLE_NODES,
    searchTerm: nodeSearch
  });

  const explanationState = useNodeExplanation(selectedProjectId, selectedNodeKey);

  useEffect(() => {
    if (!detail) {
      setCollapsedNodeKeys(new Set());
      initializedGraphIdRef.current = null;
      return;
    }

    const graphId = detail.project.graph_id;
    if (!graphId || initializedGraphIdRef.current === graphId) {
      return;
    }

    setCollapsedNodeKeys(new Set());
    initializedGraphIdRef.current = graphId;
  }, [detail]);

  useEffect(() => {
    setSelectedNodeKey(null);
    setNodeSearch("");
  }, [selectedProjectId]);

  const selectedNodeLabel = useMemo(() => {
    if (!detail || !selectedNodeKey) return null;
    const node = detail.nodes.find((candidate) => candidate.node_key === selectedNodeKey);
    return node?.label ?? null;
  }, [detail, selectedNodeKey]);

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedNodeKey(node.id);
  };

  const selectedNodeDetail = useMemo(() => {
    if (!detail || !selectedNodeKey) return null;
    return detail.node_details.find((candidate) => candidate.node_key === selectedNodeKey) ?? null;
  }, [detail, selectedNodeKey]);

  async function handleIngest() {
    if (!repoUrl) return;
    const result = await ingest(repoUrl);
    setSelectedProjectId(result.projectId);
    await refreshProjects();
  }

  return (
    <main className="shell">
      <TopBar />

      <div className="workspace">
        <aside className="sidebar">
          <IngestPanel
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            ingesting={ingesting}
            ingestError={ingestError}
            onIngest={handleIngest}
          />
          <FlowControlsPanel />
          <SnapshotsPanel
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
        </aside>

        <GraphCanvas
          name={detail?.project?.name ?? null}
          nodes={nodes}
          edges={edges}
          nodeSearch={nodeSearch}
          onNodeSearchChange={setNodeSearch}
          showCrossLinks={showCrossLinks}
          onToggleCrossLinks={() => setShowCrossLinks((value) => !value)}
          onNodeClick={onNodeClick}
          hiddenCount={hiddenCount}
        />

        <InspectorPanels
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          selectedNodeKey={selectedNodeKey}
          selectedNodeLabel={selectedNodeLabel}
          selectedNodeDetail={selectedNodeDetail}
          explanationState={explanationState}
        />
      </div>
    </main>
  );
}
