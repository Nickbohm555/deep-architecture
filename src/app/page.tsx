"use client";

import { useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel
} from "reactflow";
import "reactflow/dist/style.css";
import {
  useGraphView,
  useIngestProject,
  useProject,
  useProjects
} from "@/lib/hooks";

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { projects, loading: projectsLoading, refresh } = useProjects();
  const { ingest, loading: ingesting, error: ingestError } = useIngestProject();
  const { detail, loading: detailLoading, refresh: refreshDetail } =
    useProject(selectedProjectId);
  const { nodes, edges } = useGraphView(detail);

  async function handleIngest() {
    if (!repoUrl) return;
    const result = await ingest(repoUrl);
    setSelectedProjectId(result.projectId);
    await refresh();
    await refreshDetail();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__dot" />
          <div>
            <p className="brand__eyebrow">Deep Architecture</p>
            <h1>Flow Studio</h1>
          </div>
        </div>
        <div className="topbar__actions">
          <button className="button button--ghost" type="button">
            Compare
          </button>
          <button className="button button--primary" type="button">
            New Flow
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel">
            <h2>Load Repository</h2>
            <p>Paste a GitHub URL to generate a flow you can edit.</p>
            <label className="field">
              <span>Repository URL</span>
              <input
                placeholder="https://github.com/org/repo"
                type="url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
              />
            </label>
            <div className="row">
              <button
                className="button button--primary"
                type="button"
                onClick={handleIngest}
                disabled={ingesting}
              >
                {ingesting ? "Ingesting..." : "Ingest"}
              </button>
              <button className="button button--ghost" type="button">
                Import Graph
              </button>
            </div>
            {ingestError ? (
              <p className="status status--error">{ingestError}</p>
            ) : null}
          </section>

          <section className="panel">
            <h2>Flow Controls</h2>
            <p>Adjust the graph before saving a snapshot.</p>
            <div className="chip-row">
              <button className="chip" type="button">
                Add Node
              </button>
              <button className="chip" type="button">
                Add Edge
              </button>
              <button className="chip" type="button">
                Auto Layout
              </button>
              <button className="chip" type="button">
                Group
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Snapshots</h2>
            {projectsLoading ? <p className="status">Loading projects…</p> : null}
            {projects.map((project) => (
              <div className="snapshot" key={project.id}>
                <div>
                  <p className="snapshot__title">{project.name}</p>
                  <p className="snapshot__meta">
                    {project.status ? `Status: ${project.status}` : "No graph yet"}
                  </p>
                </div>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  Open
                </button>
              </div>
            ))}
          </section>
        </aside>

        <section className="canvas">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background gap={24} color="rgba(255,255,255,0.16)" />
            <MiniMap />
            <Controls />
            <Panel position="top-left" className="canvas__panel">
              <div>
                <p className="canvas__eyebrow">Active Graph</p>
                <h3>{detail?.project?.name ?? "Select a project"}</h3>
              </div>
              <button className="button button--ghost" type="button">
                Save Snapshot
              </button>
            </Panel>
          </ReactFlow>
        </section>

        <aside className="inspector">
          <section className="panel">
            <h2>Selection</h2>
            {detailLoading ? (
              <p>Loading project…</p>
            ) : detail?.project?.summary ? (
              <p>{detail.project.summary}</p>
            ) : (
              <p>No summary yet. Ingest a repo to generate one.</p>
            )}
          </section>
          <section className="panel">
            <h2>Signals</h2>
            <div className="signal">
              <span className="signal__tag">OpenAI Blog</span>
              <p>New API update mentioned streaming changes.</p>
            </div>
            <div className="signal">
              <span className="signal__tag">Anthropic</span>
              <p>Model context window expansion announced.</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
