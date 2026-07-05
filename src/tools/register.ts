import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type __SERVICE_PASCAL__ToolConfig = {
  name: string;
  title: string;
  description: string;
  dataSchema: z.ZodTypeAny;
  // biome-ignore lint/suspicious/noExplicitAny: Generated SDK functions have complex generic signatures that vary per endpoint; Zod schemas handle runtime validation.
  sdkFn: (opts: any) => Promise<any>;
  readOnly?: boolean;
};

type ZodDef = {
  type: string;
  left?: z.ZodTypeAny;
  right?: z.ZodTypeAny;
  options?: z.ZodTypeAny[];
};

type ZodShape = Record<string, z.ZodTypeAny>;

/**
 * Recursively extracts a flat record of Zod schemas from a potentially
 * wrapped body schema (optional, intersection, union, or plain object).
 *
 * Uses Zod v4's `_zod.def` introspection path — the stable API for accessing
 * schema definitions (replaces v3's `.def()` / `._def`).
 */
function extractShape(schema: z.ZodTypeAny): ZodShape {
  const def = (schema as { _zod: { def: ZodDef } })._zod.def;

  switch (def.type) {
    case "optional":
      return extractShape((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());

    case "object":
      return (schema as z.ZodObject<ZodShape>).shape;

    case "intersection": {
      const left = def.left ? extractShape(def.left) : {};
      const right = def.right ? extractShape(def.right) : {};
      return { ...left, ...right };
    }

    case "union": {
      const merged: ZodShape = {};

      for (const option of def.options ?? []) {
        const shape = extractShape(option);

        for (const [key, value] of Object.entries(shape)) {
          if (!(key in merged)) {
            merged[key] = value.optional();
          }
        }
      }

      return merged;
    }

    case "record":
    case "unknown":
      return {};

    default:
      return {};
  }
}

/**
 * Checks whether a Zod schema is or wraps a bigint type, walking through
 * optional/pipeline/intersection wrappers.
 */
function hasBigInt(schema: z.ZodTypeAny): boolean {
  const def = (schema as { _zod: { def: ZodDef } })._zod.def;

  if (def.type === "bigint") {
    return true;
  }

  if (def.type === "optional") {
    return hasBigInt((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
  }

  if (def.type === "intersection") {
    return (
      (def.left != null && hasBigInt(def.left)) ||
      (def.right != null && hasBigInt(def.right))
    );
  }

  if (def.type === "pipe") {
    const pipeDef = def as unknown as { in: z.ZodTypeAny; out: z.ZodTypeAny };
    return hasBigInt(pipeDef.in) || hasBigInt(pipeDef.out);
  }

  return false;
}

/**
 * Replaces any bigint-typed fields with z.number().optional() so the schema
 * can be converted to JSON Schema (which has no BigInt representation).
 * Most APIs use int64 for Unix timestamps — z.number() is correct there.
 */
function sanitizeShape(shape: ZodShape): ZodShape {
  const result: ZodShape = {};

  for (const [key, value] of Object.entries(shape)) {
    result[key] = hasBigInt(value) ? z.number().optional() : value;
  }

  return result;
}

/**
 * Extracts the input schema from a generated Zod schema. Handles two shapes:
 *
 * 1. Envelope style `{ body, path, query }` — extracts the `body` sub-schema.
 * 2. Flat/direct style (e.g. `z.object({ field1, field2 })` or `z.record`) —
 *    extracts the shape directly.
 */
export function extractInputSchema(dataSchema: z.ZodTypeAny): ZodShape {
  const def = (dataSchema as { _zod: { def: ZodDef } })._zod.def;

  if (def.type === "object") {
    const outerShape = (dataSchema as z.ZodObject<ZodShape>).shape;
    const bodyField = outerShape.body;

    if (bodyField) {
      return sanitizeShape(extractShape(bodyField));
    }
  }

  return sanitizeShape(extractShape(dataSchema));
}

type __SERVICE_PASCAL__ErrorResponse = {
  success: false;
  errors: string[];
  errorInfo?: { code: string; message?: string; requestId?: string };
};

/**
 * AGENT TODO: adjust this to match __SERVICE_TITLE__'s error envelope. The
 * default assumes `{ success: false, errors: string[], errorInfo: { code } }`.
 * Some APIs use `{ error: { message, code } }` or HTTP status only.
 */
function is__SERVICE_PASCAL__Error(
  data: unknown,
): data is __SERVICE_PASCAL__ErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as Record<string, unknown>).success === false
  );
}

function format__SERVICE_PASCAL__Error(
  data: __SERVICE_PASCAL__ErrorResponse,
): string {
  const parts = [`__SERVICE_TITLE__ API error: ${data.errors.join("; ")}`];

  if (data.errorInfo?.message) {
    parts.push(`Details: ${data.errorInfo.message}`);
  }

  if (data.errorInfo?.code) {
    parts.push(`Code: ${data.errorInfo.code}`);
  }

  return parts.join("\n");
}

function formatHttpError(error: unknown): string {
  if (error instanceof Error) {
    if ("response" in error) {
      const resp = (error as Record<string, unknown>).response;

      if (resp && typeof resp === "object" && "status" in resp) {
        const status = (resp as Record<string, unknown>).status;

        switch (status) {
          case 401:
            return "__SERVICE_TITLE__ API error: Unauthorized. Check that __SERVICE_UPPER___API_KEY is valid.";
          case 403:
            return "__SERVICE_TITLE__ API error: Forbidden. The API key lacks the required permission scope.";
          case 429:
            return "__SERVICE_TITLE__ API error: Rate limit exceeded. Wait before retrying.";
          default:
            return `__SERVICE_TITLE__ API error: HTTP ${status} - ${error.message}`;
        }
      }
    }

    return `__SERVICE_TITLE__ API error: ${error.message}`;
  }

  return `__SERVICE_TITLE__ API error: ${String(error)}`;
}

/**
 * Registers a __SERVICE_TITLE__ API tool on the MCP server.
 *
 * Extracts the `body` sub-schema from the generated `z{Endpoint}Data` Zod
 * schema and uses it as the MCP `inputSchema`. The generated SDK function
 * is called with `{ body: params }` so the params map directly to the
 * POST body. Swap the `sdkFn({ body: params })` call shape if your SDK takes
 * `{ query }` or `{ path }` parameters for the relevant endpoint.
 */
export function register__SERVICE_PASCAL__Tool(
  server: McpServer,
  config: __SERVICE_PASCAL__ToolConfig,
) {
  const readOnly = config.readOnly ?? false;
  const inputSchema = extractInputSchema(config.dataSchema);

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      // biome-ignore lint/suspicious/noExplicitAny: ZodShape (Record<string, z.ZodTypeAny>) is structurally compatible with the MCP SDK's ZodRawShapeCompat but not assignable due to zod v3/v4 union variance; runtime behavior is correct.
      inputSchema: inputSchema as any,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: !readOnly,
        idempotentHint: readOnly,
        openWorldHint: true,
      },
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await config.sdkFn({ body: params });

        if (is__SERVICE_PASCAL__Error(result)) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: format__SERVICE_PASCAL__Error(result),
              },
            ],
          };
        }

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        if (is__SERVICE_PASCAL__Error(error)) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: format__SERVICE_PASCAL__Error(error),
              },
            ],
          };
        }

        return {
          isError: true,
          content: [{ type: "text" as const, text: formatHttpError(error) }],
        };
      }
    },
  );
}
