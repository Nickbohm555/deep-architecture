-- Core entities for architecture graphs

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  latest_graph_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_repo_url_idx
  ON projects(repo_url);

CREATE TABLE IF NOT EXISTS graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  summary TEXT,
  error TEXT,
  job_id TEXT,
  source_commit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_graph_key_idx
  ON graph_nodes(graph_id, node_key);

CREATE TABLE IF NOT EXISTS graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS graph_edges_graph_idx
  ON graph_edges(graph_id);

CREATE TABLE IF NOT EXISTS agent_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES graphs(id) ON DELETE CASCADE,
  node_key TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  left_graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  right_graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  summary TEXT,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects
  ADD CONSTRAINT projects_latest_graph_fk
  FOREIGN KEY (latest_graph_id) REFERENCES graphs(id) ON DELETE SET NULL;
