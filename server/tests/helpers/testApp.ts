// Hono の app.request はHostを付けない。本番のHost検証に通るよう、未指定のときだけ loopback のHostを補う。
// Host無しの要求を送りたいテストは app.fetch(new Request(...)) を使う。
import { createApp as createAppWithoutHost, type App, type AppEnv } from "../../src/app.ts";

export type { App, AppEnv };

export function createApp(...args: Parameters<typeof createAppWithoutHost>): App {
  return withDefaultHost(createAppWithoutHost(...args));
}

export function withDefaultHost(app: App): App {
  const request = app.request;
  app.request = (input, requestInit, ...rest) => {
    if (typeof input !== "string" && !(input instanceof URL)) {
      return request(input, requestInit, ...rest);
    }
    const headers = new Headers(requestInit?.headers);
    if (!headers.has("Host")) headers.set("Host", "localhost");
    return request(input, { ...requestInit, headers }, ...rest);
  };
  return app;
}
