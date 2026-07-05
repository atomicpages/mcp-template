import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { env } from "../../env";

type SdkResponse = {
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * AGENT TODO: adjust this success-envelope to match __SERVICE_TITLE__'s
 * response shape. Default assumes `{ success, results, moreDataAvailable,
 * nextCursor, ... }`. If your API returns the payload directly (e.g.
 * `{ data: {...} }` or just the resource), simplify or remove the
 * `unwrapSdkResponse` + `data.success` checks.
 */
type __SERVICE_PASCAL__Data = {
  success: boolean;
  results?: unknown;
  moreDataAvailable?: boolean;
  nextCursor?: string;
  [key: string]: unknown;
};

/**
 * Extracts the response body from an SDK result, which may be wrapped in
 * `{ data, request, response }` depending on client config.
 */
export function unwrapSdkResponse(result: unknown): __SERVICE_PASCAL__Data {
  if (result && typeof result === "object" && "data" in result) {
    const r = result as SdkResponse;
    if (r.data && typeof r.data === "object" && "success" in r.data) {
      return r.data as __SERVICE_PASCAL__Data;
    }
  }

  return result as __SERVICE_PASCAL__Data;
}

export class __SERVICE_PASCAL__ApiError extends Error {
  constructor(
    message: string,
    public readonly errors: string[] = [],
    public readonly code?: string,
  ) {
    super(message);
    this.name = "__SERVICE_PASCAL__ApiError";
  }
}

/**
 * Calls an SDK function with `{ body }` params and returns the unwrapped
 * data. Throws `__SERVICE_PASCAL__ApiError` on API-level failures.
 *
 * AGENT TODO: change `{ body }` to `{ query }`, `{ path }`, etc. if your SDK
 * uses different parameter names per endpoint, or accept a generic options
 * builder argument.
 */
export async function callApi<T = __SERVICE_PASCAL__Data>(
  // biome-ignore lint/suspicious/noExplicitAny: SDK functions have varied generic signatures
  sdkFn: (opts: any) => Promise<any>,
  body: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  const result = await sdkFn({ body });
  const end = performance.now();

  if (env.__SERVICE_UPPER___MCP_DEBUG_HTTP_AUTH) {
    console.error(`${sdkFn.name} took ${end - start}ms`);
  }

  const data = unwrapSdkResponse(result);

  if (!data.success) {
    const errors =
      "errors" in data && Array.isArray(data.errors)
        ? (data.errors as string[])
        : [];

    const code =
      "errorInfo" in data &&
      data.errorInfo &&
      typeof data.errorInfo === "object" &&
      "code" in (data.errorInfo as Record<string, unknown>)
        ? String((data.errorInfo as Record<string, string>).code)
        : undefined;

    throw new __SERVICE_PASCAL__ApiError(
      errors.join("; ") || "__SERVICE_TITLE__ API returned success: false",
      errors,
      code,
    );
  }

  return data as T;
}

/**
 * Runs SDK calls in parallel, returning settled results so a single
 * failure doesn't abort the entire workflow.
 */
export async function callApiAll<T extends readonly unknown[]>(
  ...promises: { [K in keyof T]: Promise<T[K]> }
): Promise<{ [K in keyof T]: T[K] | undefined }> {
  const settled = await Promise.allSettled(promises);
  return settled.map((s) =>
    s.status === "fulfilled" ? s.value : undefined,
  ) as { [K in keyof T]: T[K] | undefined };
}

/** Builds the standard MCP text response used by workflow tools. */
export function workflowResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function workflowError(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

/**
 * Standard error handler for workflow tools — catches __SERVICE_PASCAL__ApiError
 * and generic errors, returning a formatted MCP error response.
 */
export function handleWorkflowError(error: unknown) {
  if (error instanceof __SERVICE_PASCAL__ApiError) {
    return workflowError(`__SERVICE_TITLE__ API error: ${error.message}`);
  }

  if (error instanceof Error) {
    if ("response" in error) {
      const resp = (error as Record<string, unknown>).response;
      if (resp && typeof resp === "object" && "status" in resp) {
        const status = (resp as Record<string, unknown>).status;
        switch (status) {
          case 401:
            return workflowError(
              "__SERVICE_TITLE__ API error: Unauthorized. Check that __SERVICE_UPPER___API_KEY is valid.",
            );
          case 403:
            return workflowError(
              "__SERVICE_TITLE__ API error: Forbidden. The API key lacks the required permission scope.",
            );
          case 429:
            return workflowError(
              "__SERVICE_TITLE__ API error: Rate limit exceeded. Wait before retrying.",
            );
          default:
            return workflowError(
              `__SERVICE_TITLE__ API error: HTTP ${status} - ${error.message}`,
            );
        }
      }
    }
    return workflowError(`__SERVICE_TITLE__ API error: ${error.message}`);
  }

  return workflowError(`__SERVICE_TITLE__ API error: ${String(error)}`);
}

export type WorkflowToolConfig = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, import("zod").ZodTypeAny>;
  readOnly?: boolean;
  handler: (
    params: Record<string, unknown>,
  ) => Promise<ReturnType<typeof workflowResponse | typeof workflowError>>;
};

/**
 * Registers a composite workflow tool on the MCP server with standard
 * annotations and error handling.
 */
export function registerWorkflowTool(
  server: InstanceType<typeof McpServer>,
  config: WorkflowToolConfig,
) {
  const readOnly = config.readOnly ?? false;

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      // biome-ignore lint/suspicious/noExplicitAny: ZodShape (Record<string, z.ZodTypeAny>) is structurally compatible with the MCP SDK's ZodRawShapeCompat but not assignable due to zod v3/v4 union variance; runtime behavior is correct.
      inputSchema: config.inputSchema as any,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: !readOnly,
        idempotentHint: readOnly,
        openWorldHint: true,
      },
    },
    async (params: Record<string, unknown>) => {
      try {
        return await config.handler(params as Record<string, unknown>);
      } catch (error) {
        return handleWorkflowError(error);
      }
    },
  );
}
