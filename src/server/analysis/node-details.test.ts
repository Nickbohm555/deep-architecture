import { describe, expect, it } from "vitest";
import {
  buildFallbackNodeDetails,
  normalizeNodeDetails,
  type NodeArchitectureDetailRecord
} from "./node-details";

describe("node-details", () => {
  it("builds fallback details for each node with flow context", () => {
    const output = {
      summary: "s",
      nodes: [
        { key: "service:gateway", kind: "service", label: "Gateway", data: {} },
        { key: "service:agent", kind: "service", label: "Agent", data: {} }
      ],
      edges: [
        {
          source: "service:gateway",
          target: "service:agent",
          kind: "http",
          label: "request",
          data: {}
        }
      ]
    };

    const details = buildFallbackNodeDetails(output);
    expect(details).toHaveLength(2);
    expect(details[0].status).toBe("fallback");
    expect(details[1].details.inputs.some((item) => item.includes("service:gateway"))).toBe(true);
  });

  it("normalizes detail payload and backfills missing nodes", () => {
    const output = {
      summary: "s",
      nodes: [
        { key: "service:gateway", kind: "service", label: "Gateway", data: {} },
        { key: "service:agent", kind: "service", label: "Agent", data: {} }
      ],
      edges: []
    };

    const raw: Array<Partial<NodeArchitectureDetailRecord>> = [
      {
        nodeKey: "service:gateway",
        details: {
          overview: " gateway overview ",
          roleInFlow: " entry point ",
          triggers: ["http", "http"],
          inputs: [""],
          outputs: ["service:agent"],
          internalFlowSteps: ["validate", "route"],
          keyFunctions: ["Gateway.handle", "Gateway.handle"],
          keyClasses: ["GatewayController"],
          dependencies: ["redis", "redis"],
          failureModes: ["timeout"],
          observability: ["latency"],
          sourcePointers: ["src/gateway.ts"]
        }
      }
    ];

    const normalized = normalizeNodeDetails(output, raw);
    expect(normalized).toHaveLength(2);
    expect(normalized[0].status).toBe("ready");
    expect(normalized[0].details.overview).toBe("gateway overview");
    expect(normalized[0].details.triggers).toEqual(["http"]);
    expect(normalized[1].status).toBe("fallback");
  });
});
