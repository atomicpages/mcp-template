// Minimal stub of the @hey-api/client-ky client surface used elsewhere in the
// template. It compiles and matches the parts touched by
// `__SERVICE_KEBAB__-request-context.ts` (setConfig + interceptors.request.use)
// so the template boots end-to-end without a real generated SDK.
//
// AGENT TODO:
// 1. Run `bunx openapi-ts` (after configuring `openapi-ts.config.ts`) to
//    generate `src/generated/client.gen.ts`.
// 2. Delete this file.
// 3. Update imports of `./client.ts` to `./generated/client.gen.ts`.
//
// See `TEMPLATE.md` → "Plug in a real SDK" for the full sequence.

import ky, { type KyInstance } from "ky";

export type ClientConfig = {
  baseUrl?: string;
  headers?: Record<string, string>;
  throwOnError?: boolean;
};

export type RequestInterceptor = (
  request: Request,
  options: { headers?: Headers },
) => Promise<Request> | Request;

type ClientShape = {
  instance: KyInstance;
  config: ClientConfig;
  setConfig: (config: ClientConfig) => void;
  interceptors: {
    request: {
      use: (interceptor: RequestInterceptor) => void;
    };
  };
};

const interceptors: RequestInterceptor[] = [];

export const client: ClientShape = {
  instance: ky.create({}),
  config: {},
  setConfig(config) {
    this.config = { ...this.config, ...config };
    this.instance = ky.create({
      prefixUrl: config.baseUrl ?? this.config.baseUrl,
      headers: config.headers ?? this.config.headers,
      throwHttpErrors: config.throwOnError ?? this.config.throwOnError ?? true,
    });
  },
  interceptors: {
    request: {
      use(interceptor) {
        interceptors.push(interceptor);
      },
    },
  },
};

/** Test-only: visible to the request-context module so its interceptor wiring is exercised. */
export function getRegisteredRequestInterceptors(): RequestInterceptor[] {
  return interceptors;
}
