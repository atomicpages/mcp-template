import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { register__SERVICE_PASCAL__Tool } from "./register.ts";

// AGENT TODO: replace this entire file with one or more domain modules
// (e.g. `src/tools/users.ts`, `src/tools/orders.ts`, ...). Each module should:
//   1. import generated SDK functions from `../generated/sdk.gen.ts`
//   2. import generated `z*Data` Zod schemas from `../generated/zod.gen.ts`
//   3. call `register__SERVICE_PASCAL__Tool` once per endpoint
//   4. set `readOnly: false` for mutating operations
//
// The shape below is the generated `z*Data` envelope (`{ body, path, query }`)
// that `extractInputSchema` understands.

const zExamplePingData = z.object({
	body: z.object({
		message: z
			.string()
			.optional()
			.describe("Optional message echoed back in the stub response"),
	}),
});

/** Stub SDK function that mimics the shape generated SDK functions return. */
async function examplePing(opts: { body: { message?: string } }) {
	return {
		success: true as const,
		results: {
			pong: opts.body.message ?? "hello from __SERVICE_TITLE__ MCP",
			receivedAt: new Date().toISOString(),
		},
	};
}

export function registerExampleTools(server: McpServer): void {
	register__SERVICE_PASCAL__Tool(server, {
		name: "__SERVICE_KEBAB___example_ping",
		title: "Example Ping",
		description:
			"Stub tool that proves the MCP server boots and the atomic registrar wires inputSchema correctly. Replace with real __SERVICE_TITLE__ endpoints.",
		dataSchema: zExamplePingData,
		sdkFn: examplePing,
	});
}
