# **SERVICE_KEBAB**-mcp

[MCP](https://modelcontextprotocol.io) server for the **SERVICE_TITLE** API.
Includes **workflow tools** that collapse common multi-step operations into
single calls, plus granular **atomic tools** for direct API access.

Runs as a **CLI** (stdio or streamable HTTP) or embedded as a **library** in
your own app.

## Quick start

### stdio (local MCP client)

```bash
__SERVICE_UPPER___API_KEY=your-key bun src/cli.ts
```

### HTTP (remote / multi-client)

```bash
__SERVICE_UPPER___API_KEY=your-key bun src/cli.ts --http
# Listens on http://localhost:3000 (override with PORT)
```

### HTTP, multi-tenant (per-request keys)

```bash
bun src/cli.ts --http --multi-tenant
# Each request must send X-__SERVICE_PASCAL__-Api-Key (or Authorization: Basic)
```

## Requirements

- **Runtime**: [Bun](https://bun.sh) (recommended) or Node 22+ for the bundled
  library.
- ****SERVICE_TITLE****: API key with the permissions your tools need.
- **HTTP transport**: The default CLI uses `Bun.serve`. For a custom HTTP stack
  (Hono, Node adapters, Workers), use
  `connect__SERVICE_PASCAL__McpHttpTransport` and wire the returned
  `handleRequest` to your runtime.

## Install (from clone)

```bash
bun install
bun run build
```

## Environment variables

| Variable                                | Required | Default                        | Description                                                                         |
| --------------------------------------- | -------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `__SERVICE_UPPER___API_KEY`             | Usually  | `""`                           | API key. Omit only for `--http --multi-tenant`.                                     |
| `PORT`                                  | No       | `3000`                         | Port for HTTP mode.                                                                 |
| `__SERVICE_UPPER___API_KEY_HEADER`      | No       | `X-__SERVICE_PASCAL__-Api-Key` | Header name for per-request API keys in multi-tenant mode.                          |
| `__SERVICE_UPPER___MCP_DEBUG_HTTP_AUTH` | No       | `false`                        | Log HTTP auth resolution to stderr (method, path, header presence — never secrets). |

See [.env.example](.env.example).

## CLI

```bash
bun src/cli.ts                      # stdio
bun src/cli.ts --http               # HTTP, single shared key from env
bun src/cli.ts --http --multi-tenant # HTTP, per-request key from header
```

## Programmatic API

```typescript
import {
  configure__SERVICE_PASCAL__Client,
  create__SERVICE_PASCAL__McpServer,
  start__SERVICE_PASCAL__McpTransport,
} from "__SERVICE_KEBAB__-mcp";

configure__SERVICE_PASCAL__Client({
  apiKey: process.env.__SERVICE_UPPER___API_KEY!,
});

const server = create__SERVICE_PASCAL__McpServer();
await start__SERVICE_PASCAL__McpTransport(server, { mode: "stdio" });
```

For custom HTTP runtimes:

```typescript
import {
  buildRequestContextFrom__SERVICE_PASCAL__Headers,
  connect__SERVICE_PASCAL__McpHttpTransport,
  create__SERVICE_PASCAL__McpServer,
} from "__SERVICE_KEBAB__-mcp";

const server = create__SERVICE_PASCAL__McpServer();
const { handleRequest } = await connect__SERVICE_PASCAL__McpHttpTransport(
  server,
  {
    buildRequestContext: buildRequestContextFrom__SERVICE_PASCAL__Headers,
    requireTenantCredentials: true,
  },
);

// Pass `handleRequest(req)` to Hono, Bun.serve, Cloudflare Workers, ...
```

## Multi-tenant security notes

- Always serve `--multi-tenant` over **TLS** in production. Header-based
  credentials are sensitive on the wire.
- For sensitive deployments, plug a custom resolver (Redis, KMS, DB) via
  `set__SERVICE_PASCAL__CredentialResolver(async (ctx) => …)` so raw API keys do
  not appear in process memory.
- Enable `__SERVICE_UPPER___MCP_DEBUG_HTTP_AUTH=true` when debugging
  proxy/Docker setups; the log lines never contain credential values.

## Project layout

| Path                                       | Role                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/__SERVICE_KEBAB__-mcp.ts`             | Library public API: client config, tool registration, server factory, transport wiring.              |
| `src/__SERVICE_KEBAB__-request-context.ts` | Per-request credentials, ALS, header bridge for HTTP.                                                |
| `src/cli.ts` / `src/index.ts`              | CLI entry.                                                                                           |
| `src/env.ts`                               | Validated env (`envalid`).                                                                           |
| `src/client.ts`                            | Stub HTTP client. **Replace with `src/generated/client.gen.ts` after running OpenAPI codegen.**      |
| `src/tools/*.ts`                           | Atomic MCP tools (1:1 API wrappers via `register__SERVICE_PASCAL__Tool`).                            |
| `src/tools/workflows/*.ts`                 | Composite workflow tools via `registerWorkflowTool`.                                                 |
| `scripts/build.ts`                         | `bun run build` → `dist/__SERVICE_KEBAB__-mcp.js`, `dist/cli.js`, `dist/__SERVICE_KEBAB__-mcp.d.ts`. |
