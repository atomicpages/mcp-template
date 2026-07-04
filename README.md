# MCP Server Template

A production-ready TypeScript scaffold for building [MCP](https://modelcontextprotocol.io)
servers that wrap a REST API. Ships with stdio + streamable HTTP transports,
multi-tenant credentials via `AsyncLocalStorage`, atomic + workflow tool
registrars, and env-gated debug logging.

This is the concrete implementation of the patterns described in the
[atomicpages/mcp-skills](https://github.com/atomicpages/mcp-skills) repo.

## Quick start

Create a new repo from this template:

```bash
gh repo create --template atomicpages/mcp-template --clone my-service-mcp
cd my-service-mcp
bun setup.ts \
  --kebab my-service \
  --pascal MyService \
  --upper MY_SERVICE \
  --title "My Service"

bun install
bun run lint
bun run typecheck
bun run build
```

`setup.ts` replaces all placeholder tokens in file contents and paths, then
self-deletes. Run with `--dry-run` first to preview changes.

For the full architecture and implementation guide, see
[TEMPLATE.md](TEMPLATE.md).

## Companion skills

The [mcp-skills](https://github.com/atomicpages/mcp-skills) repo provides three
skills that guide implementation:

- [mcp-openapi-typescript-stack](https://github.com/atomicpages/mcp-skills/blob/main/skills/mcp-openapi-typescript-stack/SKILL.md) —
  the abstract pattern this template concretizes. Read before making non-trivial
  architectural changes.
- [mcp-workflow-design](https://github.com/atomicpages/mcp-skills/blob/main/skills/mcp-workflow-design/SKILL.md) —
  composite workflow tool design.
- [mcp-builder](https://github.com/atomicpages/mcp-skills/blob/main/.agents/skills/mcp-builder/SKILL.md) —
  tool design patterns.

Install them for your agent:

```bash
npx skills add atomicpages/mcp-skills
```

## Placeholder tokens

| Token                  | Example        | Used in                                                                   |
| ---------------------- | -------------- | ------------------------------------------------------------------------- |
| `__SERVICE_KEBAB__`    | `my-service`   | File names, package name, CLI binary, symbol prefixes in a few helpers.  |
| `__SERVICE_PASCAL__`   | `MyService`    | Type and function names: `configureMyServiceClient`, etc.                |
| `__SERVICE_UPPER__`    | `MY_SERVICE`   | Env var prefix: `MY_SERVICE_API_KEY`, `MY_SERVICE_API_KEY_HEADER`, etc.  |
| `__SERVICE_TITLE__`    | `My Service`   | Free-form display name in README and tool descriptions.                  |

## Verification checklist

After `setup.ts` and `bun install`:

- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun run build` emits `dist/<service>-mcp.js`, `dist/cli.js`,
      `dist/<service>-mcp.d.ts`.
- [ ] `<UPPER>_API_KEY=test bun src/cli.ts` boots the stdio server and logs
      `"<Title> MCP server running via stdio"` to stderr.
- [ ] `bun src/cli.ts --http --multi-tenant` boots and returns `401` for a
      request without the configured API-key header:

      ```bash
      curl -s -o /dev/null -w '%{http_code}\n' \
        -X POST http://localhost:3000/ \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
      # → 401
      ```
