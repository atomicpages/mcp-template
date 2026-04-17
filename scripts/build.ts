import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });

function runBuild(args: string[]): void {
	const proc = Bun.spawnSync(["bun", "build", ...args]);

	if (proc.exitCode !== 0) {
		console.error(proc.stderr.toString());
		process.exit(1);
	}
}

runBuild([
	"./src/__SERVICE_KEBAB__-mcp.ts",
	"--outfile=dist/__SERVICE_KEBAB__-mcp.js",
	"--target=node",
	"--format=esm",
	"--packages=external",
]);

runBuild([
	"./src/cli.ts",
	"--outfile=dist/cli.js",
	"--target=node",
	"--format=esm",
	"--packages=external",
]);

let cli = readFileSync("dist/cli.js", "utf8");
cli = cli.replace(/^#!.*\n/, "");
writeFileSync("dist/cli.js", `#!/usr/bin/env node\n${cli}`);

writeFileSync(
	"dist/__SERVICE_KEBAB__-mcp.d.ts",
	`import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HandleRequestOptions } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export type Configure__SERVICE_PASCAL__ClientOptions = {
  apiKey: string;
  baseUrl?: string;
  throwOnError?: boolean;
};

export function configure__SERVICE_PASCAL__Client(
  options: Configure__SERVICE_PASCAL__ClientOptions,
): void;

export function register__SERVICE_PASCAL__Tools(server: McpServer): void;

export type Create__SERVICE_PASCAL__McpServerOptions = {
  name?: string;
  version?: string;
};

export function create__SERVICE_PASCAL__McpServer(
  options?: Create__SERVICE_PASCAL__McpServerOptions,
): McpServer;

export type __SERVICE_PASCAL__HttpRequestContext = Record<string, unknown>;

export type __SERVICE_PASCAL__CredentialResolution =
  | { apiKey: string }
  | { authorization: string }
  | null;

export type __SERVICE_PASCAL__CredentialResolver = (
  context: __SERVICE_PASCAL__HttpRequestContext,
) => Promise<__SERVICE_PASCAL__CredentialResolution>;

export function get__SERVICE_PASCAL__HttpRequestContext():
  | __SERVICE_PASCAL__HttpRequestContext
  | undefined;

export function run__SERVICE_PASCAL__HttpRequestContext<T>(
  context: __SERVICE_PASCAL__HttpRequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T>;

export function set__SERVICE_PASCAL__CredentialResolver(
  resolver: __SERVICE_PASCAL__CredentialResolver | null,
): void;

export function get__SERVICE_PASCAL__CredentialResolver(): __SERVICE_PASCAL__CredentialResolver | null;

export function __SERVICE_KEBAB__CredentialResolverFromContext(
  context: __SERVICE_PASCAL__HttpRequestContext,
): Promise<__SERVICE_PASCAL__CredentialResolution>;

export function buildRequestContextFrom__SERVICE_PASCAL__Headers(
  req: Request,
): __SERVICE_PASCAL__HttpRequestContext;

export function install__SERVICE_PASCAL__PerRequestAuthInterceptor(): void;

export function enable__SERVICE_PASCAL__HttpHeaderCredentialBridge(): void;

export type Wrap__SERVICE_PASCAL__McpHttpHandleRequestOptions = {
  buildRequestContext?: (
    req: Request,
  ) => __SERVICE_PASCAL__HttpRequestContext | Promise<__SERVICE_PASCAL__HttpRequestContext>;
  requireTenantCredentials?: boolean;
};

export function wrap__SERVICE_PASCAL__McpHttpHandleRequest(
  handleRequest: (
    req: Request,
    options?: HandleRequestOptions,
  ) => Promise<Response>,
  wrapOptions: Wrap__SERVICE_PASCAL__McpHttpHandleRequestOptions,
): (req: Request, options?: HandleRequestOptions) => Promise<Response>;

export type Connect__SERVICE_PASCAL__McpHttpOptions = {
  sessionId?: "stateless" | "uuid";
  buildRequestContext?: (
    req: Request,
  ) => __SERVICE_PASCAL__HttpRequestContext | Promise<__SERVICE_PASCAL__HttpRequestContext>;
  requireTenantCredentials?: boolean;
};

export type __SERVICE_PASCAL__McpHttpConnection = {
  transport: WebStandardStreamableHTTPServerTransport;
  handleRequest: WebStandardStreamableHTTPServerTransport["handleRequest"];
};

export function connect__SERVICE_PASCAL__McpHttpTransport(
  server: McpServer,
  options?: Connect__SERVICE_PASCAL__McpHttpOptions,
): Promise<__SERVICE_PASCAL__McpHttpConnection>;

export type StartTransportOptions =
  | { mode: "stdio" }
  | {
      mode: "http";
      port: number;
      sessionId?: "stateless" | "uuid";
      credentialMode?: "shared" | "multi-tenant";
      buildRequestContext?: (
        req: Request,
      ) => __SERVICE_PASCAL__HttpRequestContext | Promise<__SERVICE_PASCAL__HttpRequestContext>;
    };

export function start__SERVICE_PASCAL__McpTransport(
  server: McpServer,
  options: StartTransportOptions,
): Promise<void>;
`,
);

console.error(
	"Build finished: dist/__SERVICE_KEBAB__-mcp.js, dist/cli.js, dist/__SERVICE_KEBAB__-mcp.d.ts",
);
