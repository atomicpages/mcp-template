import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExampleWorkflow } from "./example-workflow.ts";

export function registerWorkflowTools(
  server: InstanceType<typeof McpServer>,
): void {
  registerExampleWorkflow(server);
}
