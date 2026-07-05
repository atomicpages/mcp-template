import ky, { type BeforeRequestHook, type KyInstance } from "ky";

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

function buildKyInstance(config: ClientConfig): KyInstance {
  const lazyHook: BeforeRequestHook = async ({ request, options: kyOpts }) => {
    let req = request;
    
    for (const fn of interceptors) {
      const result = fn(req, { headers: kyOpts.headers as Headers });
      req = result instanceof Promise ? await result : (result ?? req);
    }
    
    return req;
  };

  return ky.create({
    prefix: config.baseUrl,
    headers: config.headers,
    throwHttpErrors: config.throwOnError ?? true,
    hooks: {
      beforeRequest: [lazyHook],
    },
  });
}

export const client: ClientShape = {
  instance: ky.create({}),
  config: {},
  setConfig(config) {
    this.config = { ...this.config, ...config };
    this.instance = buildKyInstance(this.config);
  },
  interceptors: {
    request: {
      use(interceptor) {
        interceptors.push(interceptor);
      },
    },
  },
};

export function getRegisteredRequestInterceptors(): RequestInterceptor[] {
  return interceptors;
}
