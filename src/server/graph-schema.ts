export type GraphNode = {
  key: string;
  kind: string;
  label: string;
  data: Record<string, unknown>;
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: string;
  label?: string;
  data?: Record<string, unknown>;
};

export type GraphOutput = {
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const graphJsonSchema = {
  name: "architecture_graph_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "nodes", "edges"],
    properties: {
      summary: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "kind", "label", "data"],
          properties: {
            key: { type: "string" },
            kind: { type: "string" },
            label: { type: "string" },
            data: {
              type: "object",
              additionalProperties: false,
              properties: {}
            }
          }
        }
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["source", "target", "kind"],
          properties: {
            source: { type: "string" },
            target: { type: "string" },
            kind: { type: "string" },
            label: { type: "string" },
            data: {
              type: "object",
              additionalProperties: false,
              properties: {}
            }
          }
        }
      }
    }
  }
} as const;
