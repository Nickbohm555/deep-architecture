import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  type EdgeMouseHandler,
  type Edge,
  type Node,
  type NodeMouseHandler
} from "reactflow";

type GraphCanvasProps = {
  name: string | null;
  nodes: Node[];
  edges: Edge[];
  nodeSearch: string;
  onNodeSearchChange: (value: string) => void;
  showCrossLinks: boolean;
  onToggleCrossLinks: () => void;
  onNodeClick: NodeMouseHandler;
  hiddenCount: number;
};

export function GraphCanvas({
  name,
  nodes,
  edges,
  nodeSearch,
  onNodeSearchChange,
  showCrossLinks,
  onToggleCrossLinks,
  onNodeClick,
  hiddenCount
}: GraphCanvasProps) {
  const noopEdgeClick: EdgeMouseHandler = () => {};

  return (
    <section className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodeClick={onNodeClick}
        onEdgeClick={noopEdgeClick}
      >
        <Background gap={24} color="rgba(255,255,255,0.16)" />
        <MiniMap />
        <Controls />
        <Panel position="top-left" className="canvas__panel">
          <div>
            <p className="canvas__eyebrow">Active Graph</p>
            <h3>{name ?? "Select a project"}</h3>
          </div>
        </Panel>
        <Panel position="top-right" className="canvas__panel">
          <input
            className="canvas__search"
            type="search"
            placeholder="Search nodes…"
            value={nodeSearch}
            onChange={(event) => onNodeSearchChange(event.target.value)}
          />
          <button className="button button--ghost" type="button" onClick={onToggleCrossLinks}>
            {showCrossLinks ? "Hide Cross-Links" : "Show Cross-Links"}
          </button>
          {hiddenCount > 0 ? <p className="canvas__hint">{hiddenCount} nodes hidden</p> : null}
        </Panel>
      </ReactFlow>
    </section>
  );
}
