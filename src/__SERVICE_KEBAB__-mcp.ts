import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { __SERVICE_PASCAL__HttpRequestContext } from "./__SERVICE_KEBAB__-request-context.ts";
import {
	buildRequestContextFrom__SERVICE_PASCAL__Headers,
	enable__SERVICE_PASCAL__HttpHeaderCredentialBridge,
	install__SERVICE_PASCAL__PerRequestAuthInterceptor,
	wrap__SERVICE_PASCAL__McpHttpHandleRequest,
} from "./__SERVICE_KEBAB__-request-context.ts";
import { client } from "./client.ts";
import { registerExampleTools } from "./tools/example.ts";
import { registerWorkflowTools } from "./tools/workflows/index.ts";

export type Configure__SERVICE_PASCAL__ClientOptions = {
	apiKey: string;
	baseUrl?: string;
	throwOnError?: boolean;
};

/**
 * Configure the shared __SERVICE_TITLE__ API client (auth, base URL).
 * Call this before registering tools or invoking SDK methods.
 *
 * AGENT TODO: pick the auth scheme that matches __SERVICE_TITLE__:
 * - HTTP Basic with empty password (current default — username = apiKey).
 * - HTTP Basic with two-part secret: combine `${accessKey}:${secret}` and
 *   change `Configure__SERVICE_PASCAL__ClientOptions` to take both fields.
 * - Bearer / OAuth: replace `Authorization` with `Bearer ${apiKey}`.
 * - Custom header: e.g. `X-Api-Key: ${apiKey}` instead of `Authorization`.
 *
 * See `mcp-openapi-typescript-stack` skill → "Authentication" for the full
 * decision matrix and per-vendor patterns.
 */
export function configure__SERVICE_PASCAL__Client(
	options: Configure__SERVICE_PASCAL__ClientOptions,
): void {
	client.setConfig({
		baseUrl: options.baseUrl ?? "https://api.example.com",
		headers: {
			Authorization: `Basic ${btoa(`${options.apiKey}:`)}`,
		},
		throwOnError: options.throwOnError ?? true,
	});
}

/**
 * Register all __SERVICE_TITLE__ MCP tools on the given server.
 *
 * AGENT TODO: as you add domain modules under `src/tools/<domain>.ts`, import
 * their `register*Tools` function here and call it. Keep workflow tools
 * grouped under `./tools/workflows/index.ts`.
 */
export function register__SERVICE_PASCAL__Tools(
	server: InstanceType<typeof McpServer>,
): void {
	registerExampleTools(server);
	registerWorkflowTools(server);
}

export type Create__SERVICE_PASCAL__McpServerOptions = {
	name?: string;
	version?: string;
};

/** Create a new MCP server with all __SERVICE_TITLE__ tools registered. */
export function create__SERVICE_PASCAL__McpServer(
	options?: Create__SERVICE_PASCAL__McpServerOptions,
): InstanceType<typeof McpServer> {
	const server = new McpServer({
		name: options?.name ?? "__SERVICE_KEBAB__-mcp-server",
		version: options?.version ?? "1.0.0",
	});
	register__SERVICE_PASCAL__Tools(server);
	return server;
}

export type Connect__SERVICE_PASCAL__McpHttpOptions = {
	/** Stateless HTTP vs per-session IDs (default: uuid). */
	sessionId?: "stateless" | "uuid";
	/**
	 * When set, each MCP HTTP request runs under ALS with this context. Install
	 * the per-request auth interceptor and call `set__SERVICE_PASCAL__CredentialResolver`
	 * for outbound auth (e.g. Redis/KMS), or use
	 * `enable__SERVICE_PASCAL__HttpHeaderCredentialBridge()` for header-based keys.
	 */
	buildRequestContext?: (
		req: Request,
	) =>
		| __SERVICE_PASCAL__HttpRequestContext
		| Promise<__SERVICE_PASCAL__HttpRequestContext>;
	/**
	 * When true with `buildRequestContext`: empty context → `401`; non-empty
	 * context never falls back to global `configure__SERVICE_PASCAL__Client` auth.
	 * Used for multi-tenant mode.
	 */
	requireTenantCredentials?: boolean;
};

/**
 * Connected streamable HTTP transport plus a stable `handleRequest` you can
 * pass to `Bun.serve`, Hono, Cloudflare Workers, or any API that accepts Web
 * `Request`/`Response`.
 */
export type __SERVICE_PASCAL__McpHttpConnection = {
	transport: WebStandardStreamableHTTPServerTransport;
	handleRequest: WebStandardStreamableHTTPServerTransport["handleRequest"];
};

/**
 * Connect `server` to `WebStandardStreamableHTTPServerTransport` and return
 * `handleRequest` for wiring to your own HTTP runtime (no `Bun.serve`).
 */
export async function connect__SERVICE_PASCAL__McpHttpTransport(
	server: InstanceType<typeof McpServer>,
	options?: Connect__SERVICE_PASCAL__McpHttpOptions,
): Promise<__SERVICE_PASCAL__McpHttpConnection> {
	const { WebStandardStreamableHTTPServerTransport } = await import(
		"@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
	);

	const sessionKind = options?.sessionId ?? "uuid";
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator:
			sessionKind === "stateless" ? undefined : () => randomUUID(),
	});

	await server.connect(transport);

	let handleRequest: __SERVICE_PASCAL__McpHttpConnection["handleRequest"] =
		transport.handleRequest.bind(transport);

	if (options?.buildRequestContext) {
		install__SERVICE_PASCAL__PerRequestAuthInterceptor();
		handleRequest = wrap__SERVICE_PASCAL__McpHttpHandleRequest(handleRequest, {
			buildRequestContext: options.buildRequestContext,
			requireTenantCredentials: options.requireTenantCredentials === true,
		});
	}

	return {
		transport,
		handleRequest,
	};
}

export type StartTransportOptions =
	| { mode: "stdio" }
	| {
			mode: "http";
			port: number;
			/** Stateless HTTP vs per-session IDs (default: uuid). */
			sessionId?: "stateless" | "uuid";
			/**
			 * `shared` (default): one __SERVICE_TITLE__ key from `configure__SERVICE_PASCAL__Client` for all MCP HTTP requests.
			 * `multi-tenant`: per-request credentials only (configured API-key header or `Authorization: Basic`,
			 * or custom `buildRequestContext` + resolver). No fallback to the global client key; missing
			 * tenant credentials → `401`. Use TLS in production.
			 */
			credentialMode?: "shared" | "multi-tenant";
			/** Overrides default header parsing when `credentialMode` is `"multi-tenant"`. */
			buildRequestContext?: Connect__SERVICE_PASCAL__McpHttpOptions["buildRequestContext"];
	  };

/**
 * Connect the MCP server to stdio or HTTP (streamable) transport.
 * For HTTP, this uses `Bun.serve` when Bun is available. On Node, use
 * `connect__SERVICE_PASCAL__McpHttpTransport` and attach `handleRequest`
 * yourself, or use stdio.
 */
export async function start__SERVICE_PASCAL__McpTransport(
	server: InstanceType<typeof McpServer>,
	options: StartTransportOptions,
): Promise<void> {
	if (options.mode === "stdio") {
		const { StdioServerTransport } = await import(
			"@modelcontextprotocol/sdk/server/stdio.js"
		);

		const transport = new StdioServerTransport();
		await server.connect(transport);

		console.error("__SERVICE_TITLE__ MCP server running via stdio");

		return;
	}

	if (typeof Bun === "undefined") {
		throw new Error(
			'start__SERVICE_PASCAL__McpTransport({ mode: "http" }) requires Bun (Bun.serve). \
On Node use connect__SERVICE_PASCAL__McpHttpTransport() and wire handleRequest to \
your server, or use mode: "stdio".',
		);
	}

	const multiTenant = options.credentialMode === "multi-tenant";

	if (multiTenant) {
		enable__SERVICE_PASCAL__HttpHeaderCredentialBridge();
	}

	const buildRequestContext =
		options.buildRequestContext !== undefined
			? options.buildRequestContext
			: multiTenant
				? buildRequestContextFrom__SERVICE_PASCAL__Headers
				: undefined;

	const { handleRequest } = await connect__SERVICE_PASCAL__McpHttpTransport(
		server,
		{
			sessionId: options.sessionId,
			...(buildRequestContext
				? {
						buildRequestContext,
						requireTenantCredentials: multiTenant,
					}
				: {}),
		},
	);

	Bun.serve({
		port: options.port,
		fetch(req) {
			return handleRequest(req);
		},
	});

	console.error(
		`__SERVICE_TITLE__ MCP server listening on http://localhost:${options.port}`,
	);
}

export type {
	__SERVICE_PASCAL__CredentialResolution,
	__SERVICE_PASCAL__CredentialResolver,
	__SERVICE_PASCAL__HttpRequestContext,
	Wrap__SERVICE_PASCAL__McpHttpHandleRequestOptions,
} from "./__SERVICE_KEBAB__-request-context.ts";

export {
	__SERVICE_KEBAB__CredentialResolverFromContext,
	buildRequestContextFrom__SERVICE_PASCAL__Headers,
	enable__SERVICE_PASCAL__HttpHeaderCredentialBridge,
	get__SERVICE_PASCAL__CredentialResolver,
	get__SERVICE_PASCAL__HttpRequestContext,
	install__SERVICE_PASCAL__PerRequestAuthInterceptor,
	run__SERVICE_PASCAL__HttpRequestContext,
	set__SERVICE_PASCAL__CredentialResolver,
	wrap__SERVICE_PASCAL__McpHttpHandleRequest,
} from "./__SERVICE_KEBAB__-request-context.ts";
