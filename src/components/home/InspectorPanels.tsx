import { useState } from "react";
import type { NodeExplanation, ProjectDetail } from "@/lib/projects-types";

type InspectorPanelsProps = {
  detail: ProjectDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  selectedNodeKey: string | null;
  selectedNodeLabel: string | null;
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
  explanationState
}: InspectorPanelsProps) {
  const [activeTab, setActiveTab] = useState<"details" | "explain">("details");

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
