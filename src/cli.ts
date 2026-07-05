import {
  configure__SERVICE_PASCAL__Client,
  create__SERVICE_PASCAL__McpServer,
  start__SERVICE_PASCAL__McpTransport,
} from "./__SERVICE_KEBAB__-mcp.ts";
import { env } from "./env.ts";

const useHttp = process.argv.includes("--http");
const multiTenant = process.argv.includes("--multi-tenant");

const needsGlobalApiKey = !useHttp || (useHttp && !multiTenant);

if (needsGlobalApiKey && env.__SERVICE_UPPER___API_KEY.length === 0) {
  console.error(
    "__SERVICE_UPPER___API_KEY is required for stdio and for HTTP without --multi-tenant.",
  );

  process.exit(1);
}

configure__SERVICE_PASCAL__Client({ apiKey: env.__SERVICE_UPPER___API_KEY });
const server = create__SERVICE_PASCAL__McpServer();

let handle: { close: () => Promise<void> };

if (useHttp) {
  handle = await start__SERVICE_PASCAL__McpTransport(server, {
    mode: "http",
    port: env.PORT,
    sessionId: "uuid",
    ...(multiTenant ? { credentialMode: "multi-tenant" } : {}),
  });
} else {
  handle = await start__SERVICE_PASCAL__McpTransport(server, { mode: "stdio" });
}

function shutdown() {
  handle.close().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
