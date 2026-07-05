> **Template mode:** If you haven't run `setup.ts` yet, see
> [TEMPLATE.md](TEMPLATE.md) for scaffolding instructions and companion skill
> links. Pass `--openapi-url <url>` to pre-fill `openapi-ts.config.ts` with the
> target API's OpenAPI spec URL.

# Agent guide — **SERVICE_KEBAB**-mcp

## What this is

TypeScript **MCP server** for the **SERVICE_TITLE** API: tools wrap the HTTP API
and (optionally) compose multi-step workflows.

Ships as an npm-style package: **library** (`configure__SERVICE_PASCAL__Client`,
`register__SERVICE_PASCAL__Tools`, `create__SERVICE_PASCAL__McpServer`, HTTP
transport helpers) and **CLI** `__SERVICE_KEBAB__-mcp` (stdio default;
streamable HTTP with Bun).

## Runtime and tooling

- **Use [Bun](https://bun.sh)** for install, scripts, and local runs
  (`bun install`, `bun run ...`, `bun src/index.ts`).
- **Lint**: `bun run lint` (Biome). **Types**: `bun run typecheck`.
- **Build**: `bun run build` bundles `src/__SERVICE_KEBAB__-mcp.ts` →
  `dist/__SERVICE_KEBAB__-mcp.js` and `src/cli.ts` → `dist/cli.js`. Run before
  validating publish artifacts.
- **Codegen**: `bun run codegen` regenerates the SDK from the OpenAPI spec
  configured in `openapi-ts.config.ts`.

## Environment

- **`__SERVICE_UPPER___API_KEY`** — required for real API calls. Optional
  **`PORT`** for HTTP (default `3000`). See `.env.example` and `README.md` for
  CLI flags (`--http`, `--multi-tenant`) and programmatic per-request
  credentials.

## Repo layout (where to edit)

| Area                                       | Role                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/__SERVICE_KEBAB__-mcp.ts`             | Public API: client config, tool registration orchestration, MCP server factory, stdio/HTTP transport wiring.                               |
| `src/__SERVICE_KEBAB__-request-context.ts` | Per-request credentials, ALS, header bridge for HTTP.                                                                                      |
| `src/cli.ts` / `src/index.ts`              | CLI entry.                                                                                                                                 |
| `src/env.ts`                               | Validated env.                                                                                                                             |
| `src/client.ts`                            | TODO: replace with generated client (`src/generated/client.gen.ts`) after running OpenAPI codegen.                                         |
| `src/tools/*.ts`                           | **Atomic MCP tools.** Each file calls `register__SERVICE_PASCAL__Tool` with `name`, `title`, `description`, Zod `dataSchema`, and `sdkFn`. |
| `src/tools/register.ts`                    | Shared helper: maps Zod-validated args → SDK calls, handles read-only hints.                                                               |
| `src/tools/workflows/`                     | **Composite workflow tools.** Each file orchestrates multiple SDK calls via `registerWorkflowTool`. Uses hand-crafted Zod input schemas.   |
| `src/tools/workflows/helpers.ts`           | Shared utilities for workflow tools: `callApi`, `callApiAll`, error handling, response builders.                                           |

> TODO(**SERVICE_TITLE**): once you generate the SDK, add a row for
> `src/generated/` and note that **everything in it is generated code; do not
> hand-edit**.

## Adding or changing a tool

### Atomic tools (1:1 API wrappers)

1. Confirm the endpoint exists in your generated `src/generated/sdk.gen.ts` and
   matching `z*Data` in `src/generated/zod.gen.ts`. If the API surface changed,
   regenerate, then implement.
2. In the appropriate `src/tools/<domain>.ts`, add a
   `register__SERVICE_PASCAL__Tool` block: stable `__SERVICE_KEBAB___*` name,
   clear `title`/`description`, correct `dataSchema`, `sdkFn`, and
   `readOnly: false` only for mutating operations.
3. If you added a new `register*Tools` module, import and call it from
   `register__SERVICE_PASCAL__Tools` in `src/__SERVICE_KEBAB__-mcp.ts`.
4. Run `bun run lint` and `bun run build`; smoke-test with the MCP inspector
   (`bun run mcp`).

### Workflow tools (composite, multi-step)

1. Create a new file in `src/tools/workflows/`.
2. Use `registerWorkflowTool` from `helpers.ts` with a hand-crafted Zod
   `inputSchema` (NOT the generated `z*Data` schemas).
3. Import SDK functions directly and call them via `callApi()` / `callApiAll()`
   from `helpers.ts`.
4. Export a `register*` function and add it to `src/tools/workflows/index.ts`.
5. Design for **outcomes**: accept human-readable inputs (names, titles),
   resolve to IDs internally, aggregate related data, and return a `summary`
   field alongside structured `data`.

## TODO checklist for the agent customizing this template

- [ ] Replace `src/client.ts` with a real client (OpenAPI codegen or
      hand-written).
- [ ] Update `configure__SERVICE_PASCAL__Client` in
      `src/__SERVICE_KEBAB__-mcp.ts` with the correct base URL and auth scheme
      (Basic / Bearer / custom header).
- [ ] Replace `src/tools/example.ts` with real domain modules.
- [ ] Replace `src/tools/workflows/example-workflow.ts` with real workflows.
- [ ] Adjust the success-envelope assumption (`{ success, results }`) in
      `src/tools/register.ts` and `src/tools/workflows/helpers.ts` if
      **SERVICE_TITLE** uses a different shape.
- [ ] Update this AGENTS.md with project-specific conventions.
