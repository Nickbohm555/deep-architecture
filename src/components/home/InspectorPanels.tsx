import { useState } from "react";
import type { NodeExplanation, ProjectDetail } from "@/lib/projects-types";

type InspectorPanelsProps = {
  detail: ProjectDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  selectedNodeKey: string | null;
  selectedNodeLabel: string | null;
  selectedNodeDetail: ProjectDetail["node_details"][number] | null;
  explanationState: {
    explanation: NodeExplanation | null;
    draft: string;
    setDraft: (text: string) => void;
    question: string;
    setQuestion: (text: string) => void;
    loading: boolean;
    saving: boolean;
    enqueueing: boolean;
    error: string | null;
    ask: () => Promise<void>;
    save: () => Promise<void>;
  };
};

export function InspectorPanels({
  detail,
  detailLoading,
  detailError,
  selectedNodeKey,
  selectedNodeLabel,
  selectedNodeDetail,
  explanationState
}: InspectorPanelsProps) {
  const [activeTab, setActiveTab] = useState<"details" | "internals" | "explain">("details");

  function renderList(title: string, values: string[]) {
    return (
      <div className="detail-section">
        <h4>{title}</h4>
        {values.length > 0 ? (
          <ul className="detail-list">
            {values.map((value) => (
              <li key={`${title}:${value}`}>{value}</li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty">Not detected.</p>
        )}
      </div>
    );
  }

  return (
    <aside className="inspector">
      <section className="panel">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "details" ? "tab--active" : ""}`}
            onClick={() => setActiveTab("details")}
            type="button"
          >
            Details
          </button>
          <button
            className={`tab ${activeTab === "internals" ? "tab--active" : ""}`}
            onClick={() => setActiveTab("internals")}
            type="button"
          >
            Node Internals
          </button>
          <button
            className={`tab ${activeTab === "explain" ? "tab--active" : ""}`}
            onClick={() => setActiveTab("explain")}
            type="button"
          >
            Explain
          </button>
        </div>

        {activeTab === "details" ? (
          <>
            <h2>Selection</h2>
            {selectedNodeKey ? (
              <div className="selection-block">
                <p className="selection-label">{selectedNodeLabel ?? selectedNodeKey}</p>
                <p className="selection-key">{selectedNodeKey}</p>
              </div>
            ) : null}
            {detailLoading ? (
              <p>Loading project…</p>
            ) : detailError ? (
              <p className="status status--error">{detailError}</p>
            ) : detail?.project?.summary ? (
              <p>{detail.project.summary}</p>
            ) : (
              <p>No summary yet. Ingest a repo to generate one.</p>
            )}
          </>
        ) : activeTab === "internals" ? (
          <>
            <h2>Node Internals</h2>
            {selectedNodeKey ? (
              <div className="selection-block">
                <p className="selection-label">{selectedNodeLabel ?? selectedNodeKey}</p>
                <p className="selection-key">{selectedNodeKey}</p>
              </div>
            ) : (
              <p>Select a node to inspect structured internals.</p>
            )}

            {selectedNodeDetail ? (
              <div className="detail-grid">
                <div className="detail-section">
                  <h4>Overview</h4>
                  <p>{selectedNodeDetail.details.overview || "No overview generated."}</p>
                </div>
                <div className="detail-section">
                  <h4>Role In Flow</h4>
                  <p>{selectedNodeDetail.details.roleInFlow || "No role summary generated."}</p>
                </div>
                {renderList("Triggers", selectedNodeDetail.details.triggers)}
                {renderList("Inputs", selectedNodeDetail.details.inputs)}
                {renderList("Outputs", selectedNodeDetail.details.outputs)}
                {renderList("Internal Steps", selectedNodeDetail.details.internalFlowSteps)}
                {renderList("Key Functions", selectedNodeDetail.details.keyFunctions)}
                {renderList("Key Classes", selectedNodeDetail.details.keyClasses)}
                {renderList("Dependencies", selectedNodeDetail.details.dependencies)}
                {renderList("Failure Modes", selectedNodeDetail.details.failureModes)}
                {renderList("Observability", selectedNodeDetail.details.observability)}
                {renderList("Source Pointers", selectedNodeDetail.details.sourcePointers)}
                {selectedNodeDetail.error ? (
                  <p className="status status--error">{selectedNodeDetail.error}</p>
                ) : null}
              </div>
            ) : selectedNodeKey ? (
              <p className="status">Node internals are not available yet for this graph.</p>
            ) : null}
          </>
        ) : (
          <>
            <h2>Explain Node</h2>
            {selectedNodeKey ? (
              <p className="selection-key">{selectedNodeKey}</p>
            ) : (
              <p>Select a node from the graph to request an explanation.</p>
            )}

            <div className="row">
              <button
                className="button button--primary"
                type="button"
                onClick={() => void explanationState.ask()}
                disabled={!selectedNodeKey || explanationState.enqueueing}
              >
                {explanationState.enqueueing ? "Queueing…" : "Ask AI"}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void explanationState.save()}
                disabled={!selectedNodeKey || explanationState.saving}
              >
                {explanationState.saving ? "Saving…" : "Save"}
              </button>
            </div>
            <label className="field">
              <span>Question (Optional)</span>
              <textarea
                className="field__textarea"
                value={explanationState.question}
                onChange={(event) => explanationState.setQuestion(event.target.value)}
                placeholder="What do you want to understand about this node?"
                rows={3}
              />
            </label>

            {explanationState.explanation?.status ? (
              <p className="status">Status: {explanationState.explanation.status}</p>
            ) : null}
            {explanationState.explanation?.question ? (
              <p className="status">Last question: {explanationState.explanation.question}</p>
            ) : null}
            {explanationState.explanation?.context?.retrievalQuery ? (
              <p className="status">
                Retrieval query: {explanationState.explanation.context.retrievalQuery}
              </p>
            ) : null}
            {explanationState.loading ? <p className="status">Loading explanation…</p> : null}
            {explanationState.explanation?.error ? (
              <p className="status status--error">{explanationState.explanation.error}</p>
            ) : null}
            {explanationState.error ? (
              <p className="status status--error">{explanationState.error}</p>
            ) : null}

            <label className="field">
              <span>Explanation</span>
              <textarea
                className="field__textarea"
                value={explanationState.draft}
                onChange={(event) => explanationState.setDraft(event.target.value)}
                placeholder="AI explanation will appear here. You can edit before saving."
                rows={10}
              />
            </label>

            {explanationState.explanation?.context?.citations?.length ? (
              <div className="detail-section">
                <h4>Citations</h4>
                <ul className="detail-list">
                  {explanationState.explanation.context.citations.map((citation) => (
                    <li key={`${citation.path}:${citation.reason}`}>
                      <code>{citation.path}</code>: {citation.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Signals</h2>
        <p>External signals are not configured for this workspace.</p>
      </section>
    </aside>
  );
}
