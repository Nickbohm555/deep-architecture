"use client";

import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

const nodes = [
  {
    id: "repo",
    data: { label: "Repo Ingest" },
    position: { x: 0, y: 0 },
    type: "default"
  },
  {
    id: "graph",
    data: { label: "Graph JSON" },
    position: { x: 220, y: 0 },
    type: "default"
  },
  {
    id: "ui",
    data: { label: "React Flow UI" },
    position: { x: 440, y: 0 },
    type: "default"
  }
];

const edges = [
  { id: "e1", source: "repo", target: "graph" },
  { id: "e2", source: "graph", target: "ui" }
];

export default function HomePage() {
  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Deep Architecture</h1>
          <p>Explore and compare system data flows.</p>
        </div>
        <div className="app__actions">
          <button type="button">Ingest Repo</button>
          <button type="button">Compare</button>
        </div>
      </header>
      <section className="app__canvas">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background gap={16} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}
