import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  callApi,
  callApiAll,
  registerWorkflowTool,
  workflowError,
  workflowResponse,
} from "./helpers";

// AGENT TODO: replace this file with real workflow tools. A workflow tool:
//   1. accepts human-readable inputs (names, titles, emails) via a hand-written
//      Zod `inputSchema` (NOT the generated `z*Data` envelope)
//   2. resolves those inputs to IDs internally (often via a search SDK call)
//   3. fans out parallel SDK calls with `callApiAll` to gather related data
//   4. returns a `summary` string + structured `data` object so agents can
//      either render the summary or drill into the data
//
// See `mcp-workflow-design` skill for the full design checklist.

type ListResult = {
  success: boolean;
  results: Record<string, unknown>[];
};

type InfoResult = {
  success: boolean;
  results: Record<string, unknown>;
};

// Stub SDK functions — swap for real `../../generated/sdk.gen.ts` exports.
async function searchEntity(_opts: {
  body: Record<string, unknown>;
}): Promise<ListResult> {
  return { success: true, results: [] };
}

async function getEntityInfo(opts: {
  body: { id: string };
}): Promise<InfoResult> {
  return {
    success: true,
    results: { id: opts.body.id, name: "Example", relatedIds: [] },
  };
}

async function listRelated(_opts: {
  body: { entityId: string };
}): Promise<ListResult> {
  return { success: true, results: [] };
}

export function registerExampleWorkflow(
  server: InstanceType<typeof McpServer>,
): void {
  registerWorkflowTool(server, {
    name: "__SERVICE_KEBAB___example_workflow",
    title: "Example 360 Workflow",
    description:
      "Stub workflow tool demonstrating the name-vs-id resolution pattern, parallel fan-out via callApiAll, and the summary + data response shape. Replace with a real composite tool for __SERVICE_TITLE__.",
    inputSchema: {
      id: z
        .string()
        .optional()
        .describe("Entity UUID — fastest lookup if known"),
      name: z
        .string()
        .optional()
        .describe("Entity name to search for if id is not known"),
    },
    handler: async (params) => {
      const { id, name } = params as { id?: string; name?: string };

      if (!id && !name) {
        return workflowError("Provide at least one of: id or name.");
      }

      let entity: Record<string, unknown> | undefined;

      if (id) {
        const data = await callApi<InfoResult>(getEntityInfo, { id });
        entity = data.results;
      } else if (name) {
        const data = await callApi<ListResult>(searchEntity, { name });

        if (!data.results || data.results.length === 0) {
          return workflowError(`No entity found matching name "${name}".`);
        }

        if (data.results.length > 1) {
          return workflowResponse({
            summary: `Found ${data.results.length} matching entities. Specify an id to drill in.`,
            entities: data.results.map((e) => ({ id: e.id, name: e.name })),
          });
        }

        entity = data.results[0];
      }

      if (!entity) {
        return workflowError("Could not resolve entity.");
      }

      const relatedIds = (entity.relatedIds as string[] | undefined) ?? [];

      const [related] = await callApiAll(
        callApi<ListResult>(listRelated, {
          entityId: entity.id as string,
        }),
        ...relatedIds
          .slice(0, 5)
          .map((rid) => callApi<InfoResult>(getEntityInfo, { id: rid })),
      );

      return workflowResponse({
        summary: `${entity.name} — ${(related?.results ?? []).length} related items`,
        data: {
          entity,
          related: related?.results ?? [],
        },
      });
    },
  });
}
