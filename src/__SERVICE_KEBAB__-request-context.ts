import { AsyncLocalStorage } from "node:async_hooks";
import type { HandleRequestOptions } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { client } from "./client.ts";
import { env } from "./env.ts";

/**
 * Opaque per-MCP-request context. Typically holds a tenantId, credential ref,
 * forwarded Authorization header, or raw API key. Avoid storing long-lived
 * secrets here in strict deployments — store a ref and resolve via a custom
 * `__SERVICE_PASCAL__CredentialResolver`.
 */
export type __SERVICE_PASCAL__HttpRequestContext = Record<string, unknown>;

export type __SERVICE_PASCAL__CredentialResolution =
	| { apiKey: string }
	| { authorization: string }
	| null;

export type __SERVICE_PASCAL__CredentialResolver = (
	context: __SERVICE_PASCAL__HttpRequestContext,
) => Promise<__SERVICE_PASCAL__CredentialResolution>;

const __SERVICE_KEBAB__HttpRequestAsyncLocalStorage =
	new AsyncLocalStorage<__SERVICE_PASCAL__HttpRequestContext>();

/** When true, outbound calls must not use the global client Authorization fallback. */
const __SERVICE_KEBAB__StrictTenantCredentialsAls =
	new AsyncLocalStorage<boolean>();

let credentialResolver: __SERVICE_PASCAL__CredentialResolver | null = null;
let interceptorInstalled = false;

export function get__SERVICE_PASCAL__HttpRequestContext():
	| __SERVICE_PASCAL__HttpRequestContext
	| undefined {
	return __SERVICE_KEBAB__HttpRequestAsyncLocalStorage.getStore();
}

export function run__SERVICE_PASCAL__HttpRequestContext<T>(
	context: __SERVICE_PASCAL__HttpRequestContext,
	fn: () => T | Promise<T>,
): T | Promise<T> {
	return __SERVICE_KEBAB__HttpRequestAsyncLocalStorage.run(context, fn);
}

/** Replace the async resolver used for outbound calls when HTTP request context is active. Pass `null` to clear. */
export function set__SERVICE_PASCAL__CredentialResolver(
	resolver: __SERVICE_PASCAL__CredentialResolver | null,
): void {
	credentialResolver = resolver;
}

export function get__SERVICE_PASCAL__CredentialResolver(): __SERVICE_PASCAL__CredentialResolver | null {
	return credentialResolver;
}

/**
 * Default resolver that uses `context.apiKey` (string) or `context.authorization`
 * (full header value). For simple header bridging; prefer custom resolvers
 * (Redis, KMS, DB) for sensitive multi-tenant setups.
 */
export async function __SERVICE_KEBAB__CredentialResolverFromContext(
	context: __SERVICE_PASCAL__HttpRequestContext,
): Promise<__SERVICE_PASCAL__CredentialResolution> {
	const auth = context.authorization;

	if (typeof auth === "string" && auth.length > 0) {
		return { authorization: auth };
	}

	const apiKey = context.apiKey;

	if (typeof apiKey === "string" && apiKey.length > 0) {
		return { apiKey };
	}

	return null;
}

/**
 * Map incoming MCP HTTP request to context. Default: configured API-key header
 * or `Authorization: Basic` (username = API key, RFC 7617). Use only on trusted
 * networks / TLS.
 *
 * AGENT TODO: If __SERVICE_TITLE__ uses Bearer tokens, parse `Authorization: Bearer …`
 * here and return `{ authorization: auth }` so the resolver passes it through verbatim.
 */
export function buildRequestContextFrom__SERVICE_PASCAL__Headers(
	req: Request,
): __SERVICE_PASCAL__HttpRequestContext {
	const headerKey = req.headers
		.get(env.__SERVICE_UPPER___API_KEY_HEADER.toLowerCase())
		?.trim();

	if (headerKey) {
		return { apiKey: headerKey };
	}

	const auth = req.headers.get("authorization");

	if (auth?.toLowerCase().startsWith("basic ")) {
		try {
			const b64 = auth.slice(6).trim();
			const decoded = atob(b64);
			const colon = decoded.indexOf(":");
			const user = colon >= 0 ? decoded.slice(0, colon) : decoded;

			if (user) {
				return { apiKey: user };
			}
		} catch {
			/* invalid basic */
		}
	}

	return {};
}

function contextHasKeys(
	context: __SERVICE_PASCAL__HttpRequestContext,
): boolean {
	return Object.keys(context).length > 0;
}

/** Safe request metadata for logs — no secrets. */
function describeHttpAuthRequest(req: Request): {
	method: string;
	pathname: string;
	hasConfiguredApiKeyHeader: boolean;
	hasAuthorizationBasic: boolean;
	hasMcpSessionIdHeader: boolean;
} {
	let pathname = "";

	try {
		pathname = new URL(req.url).pathname;
	} catch {
		pathname = "(invalid-url)";
	}

	const apiKeyHeaderName = env.__SERVICE_UPPER___API_KEY_HEADER.toLowerCase();
	const rawKey = req.headers.get(apiKeyHeaderName)?.trim();
	const auth = req.headers.get("authorization");
	const basic =
		typeof auth === "string" && auth.toLowerCase().startsWith("basic ");

	return {
		method: req.method,
		pathname,
		hasConfiguredApiKeyHeader: Boolean(rawKey && rawKey.length > 0),
		hasAuthorizationBasic: basic,
		hasMcpSessionIdHeader: Boolean(req.headers.get("mcp-session-id")?.trim()),
	};
}

function logHttpAuthDebug(payload: Record<string, unknown>): void {
	if (!env.__SERVICE_UPPER___MCP_DEBUG_HTTP_AUTH) {
		return;
	}

	console.error("[__SERVICE_KEBAB__-mcp] http-auth", payload);
}

/**
 * Idempotent. Registers a request interceptor that, when ALS has context and a
 * resolver is set, sets `Authorization` from `await resolver(context)`.
 *
 * IMPORTANT (the @hey-api/client-ky pitfall): the generated client passes BOTH
 * the `Request` object AND a `kyOptions` object whose `headers` is the same
 * reference as `options.headers`. Ky merges `kyOptions.headers` ON TOP of the
 * Request headers, so we must update `options.headers` — not just the Request.
 * Otherwise the global config's Authorization (e.g. empty-key Basic Og==) will
 * silently overwrite whatever we set here, causing 401s in multi-tenant mode.
 *
 * See the `mcp-openapi-typescript-stack` skill → "@hey-api/client-ky
 * interceptor pitfall" for the full walkthrough.
 */
export function install__SERVICE_PASCAL__PerRequestAuthInterceptor(): void {
	if (interceptorInstalled) {
		return;
	}

	interceptorInstalled = true;

	client.interceptors.request.use(async (request, options) => {
		const ctx = __SERVICE_KEBAB__HttpRequestAsyncLocalStorage.getStore();
		const resolve = credentialResolver;
		const strictTenant =
			__SERVICE_KEBAB__StrictTenantCredentialsAls.getStore() === true;

		logHttpAuthDebug({
			phase: "interceptor",
			hasAlsContext: !!ctx,
			alsContextKeys: ctx ? Object.keys(ctx) : [],
			hasResolver: !!resolve,
			strictTenant,
			targetUrl: request.url,
		});

		const optsHeaders = options?.headers as Headers | undefined;

		if (!ctx || !resolve || !contextHasKeys(ctx)) {
			if (strictTenant) {
				logHttpAuthDebug({
					phase: "interceptor",
					decision: "strip_auth",
					reason: "no_als_context_strict_tenant",
				});
				optsHeaders?.delete("Authorization");
				return request;
			}

			logHttpAuthDebug({
				phase: "interceptor",
				decision: "passthrough_global",
				reason: "no_als_context_non_strict",
			});
			return request;
		}

		const creds = await resolve(ctx);

		if (creds === null) {
			if (strictTenant) {
				logHttpAuthDebug({
					phase: "interceptor",
					decision: "strip_auth",
					reason: "resolver_returned_null_strict_tenant",
				});
				optsHeaders?.delete("Authorization");
				return request;
			}

			return request;
		}

		const authValue =
			"authorization" in creds
				? creds.authorization
				: `Basic ${btoa(`${creds.apiKey}:`)}`;

		logHttpAuthDebug({
			phase: "interceptor",
			decision: "set_tenant_auth",
			credType: "authorization" in creds ? "authorization" : "apiKey",
		});

		optsHeaders?.set("Authorization", authValue);
		return request;
	});
}

/** Install interceptor + set the default header-bridge resolver. */
export function enable__SERVICE_PASCAL__HttpHeaderCredentialBridge(): void {
	install__SERVICE_PASCAL__PerRequestAuthInterceptor();
	set__SERVICE_PASCAL__CredentialResolver(
		__SERVICE_KEBAB__CredentialResolverFromContext,
	);
}

export type Wrap__SERVICE_PASCAL__McpHttpHandleRequestOptions = {
	buildRequestContext?: (
		req: Request,
	) =>
		| __SERVICE_PASCAL__HttpRequestContext
		| Promise<__SERVICE_PASCAL__HttpRequestContext>;
	/**
	 * When true: requests with empty context get `401` (MCP is not invoked).
	 * When context is non-empty, outbound calls never fall back to the global
	 * `configure__SERVICE_PASCAL__Client` Authorization header (missing / unresolved
	 * tenant creds strip `Authorization` so calls fail at __SERVICE_TITLE__).
	 */
	requireTenantCredentials?: boolean;
};

function tenantCredentialsUnauthorizedResponse(): Response {
	return new Response(
		JSON.stringify({
			error: "Unauthorized",
			message:
				"Missing or unresolved __SERVICE_TITLE__ tenant credentials. Send X-__SERVICE_PASCAL__-Api-Key, Authorization: Basic (username = API key), or use a custom buildRequestContext + credential resolver.",
		}),
		{
			status: 401,
			headers: { "Content-Type": "application/json" },
		},
	);
}

/**
 * Run each MCP HTTP request under ALS with context from `buildRequestContext(req)`.
 * Empty context skips ALS (global `configure__SERVICE_PASCAL__Client` auth only),
 * unless `requireTenantCredentials` is true (then empty context yields 401).
 */
export function wrap__SERVICE_PASCAL__McpHttpHandleRequest(
	handleRequest: (
		req: Request,
		options?: HandleRequestOptions,
	) => Promise<Response>,
	wrapOptions: Wrap__SERVICE_PASCAL__McpHttpHandleRequestOptions,
): (req: Request, options?: HandleRequestOptions) => Promise<Response> {
	const build =
		wrapOptions.buildRequestContext ??
		(() => ({}) as __SERVICE_PASCAL__HttpRequestContext);
	const requireTenant = wrapOptions.requireTenantCredentials === true;

	return async (req, opts) => {
		const ctx = await build(req);
		const reqMeta = describeHttpAuthRequest(req);
		const emptyContext = !contextHasKeys(ctx);

		logHttpAuthDebug({
			phase: "wrap",
			...reqMeta,
			requireTenantCredentials: requireTenant,
			contextKeyNames: Object.keys(ctx),
			emptyContext,
		});

		if (emptyContext) {
			if (requireTenant) {
				logHttpAuthDebug({
					phase: "wrap",
					decision: "401",
					reason: "empty_tenant_context",
					...reqMeta,
				});
				return tenantCredentialsUnauthorizedResponse();
			}
			return handleRequest(req, opts);
		}

		if (requireTenant) {
			return __SERVICE_KEBAB__StrictTenantCredentialsAls.run(true, () =>
				run__SERVICE_PASCAL__HttpRequestContext(ctx, () =>
					handleRequest(req, opts),
				),
			);
		}

		return run__SERVICE_PASCAL__HttpRequestContext(ctx, () =>
			handleRequest(req, opts),
		);
	};
}
