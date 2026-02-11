import type { Dispatch, SetStateAction } from "react";

type IngestPanelProps = {
  repoUrl: string;
  setRepoUrl: Dispatch<SetStateAction<string>>;
  ingesting: boolean;
  ingestError: string | null;
  onIngest: () => void | Promise<void>;
};

export function IngestPanel({
  repoUrl,
  setRepoUrl,
  ingesting,
  ingestError,
  onIngest
}: IngestPanelProps) {
  return (
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
          onClick={() => void onIngest()}
          disabled={ingesting}
        >
          {ingesting ? "Ingesting..." : "Ingest"}
        </button>
      </div>
      {ingestError ? <p className="status status--error">{ingestError}</p> : null}
    </section>
  );
}
