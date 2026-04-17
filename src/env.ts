import { bool, cleanEnv, num, str } from "envalid";

export const env = cleanEnv(process.env, {
	/** Empty is allowed when using HTTP `--multi-tenant` only (per-request keys). */
	__SERVICE_UPPER___API_KEY: str({
		default: "",
		desc: "The API key for __SERVICE_TITLE__",
	}),
	PORT: num({ default: 3000, desc: "Port for HTTP transport mode" }),
	__SERVICE_UPPER___API_KEY_HEADER: str({
		default: "X-__SERVICE_PASCAL__-Api-Key",
		desc: "The header name multi-tenant HTTP clients use to send their per-request API key",
	}),
	/**
	 * Log MCP HTTP auth resolution (method, path, header presence — never secrets).
	 * Enable when debugging multi-tenant / Docker.
	 */
	__SERVICE_UPPER___MCP_DEBUG_HTTP_AUTH: bool({
		default: false,
		desc: "Debug logging for streamable HTTP tenant credential resolution",
	}),
});
