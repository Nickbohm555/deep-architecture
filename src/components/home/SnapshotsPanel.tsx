import type { ProjectRow } from "@/lib/projects-types";

type SnapshotsPanelProps = {
  projects: ProjectRow[];
  projectsLoading: boolean;
  projectsError: string | null;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
};

export function SnapshotsPanel({
  projects,
  projectsLoading,
  projectsError,
  selectedProjectId,
  onSelectProject
}: SnapshotsPanelProps) {
  return (
    <section className="panel">
      <h2>Snapshots</h2>
      {projectsLoading ? <p className="status">Loading projects…</p> : null}
      {projectsError ? <p className="status status--error">{projectsError}</p> : null}
      {projects.map((project) => {
        const isActive = project.id === selectedProjectId;
        return (
          <div
            className={`snapshot ${isActive ? "snapshot--active" : ""}`}
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectProject(project.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onSelectProject(project.id);
              }
            }}
          >
            <div>
              <p className="snapshot__title">{project.name}</p>
              <p className="snapshot__meta">
                {project.status ? `Status: ${project.status}` : "No graph yet"}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
