import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  // e.g. https://example.com/openapi/api-spec.json
  // this MUST be a valid Swagger or OpenAPI spec URL
  input: "{{ API_OPENAPI_PATH }}",
  output: {
    path: "./src/generated",
    clean: true,
    postProcess: ["biome:format"],
  },
  plugins: [
    "@hey-api/client-ky",
    "@hey-api/schemas",
    { name: "@hey-api/transformers", dates: true, bigInt: false },
    {
      name: "@hey-api/typescript",
      enums: "typescript",
      comments: true,
    },
    {
      name: "@hey-api/sdk",
      transformer: true,
      comments: true,
      validator: { request: "zod", response: "zod" },
    },
  ],
  logs: { level: "info", file: false },
});
