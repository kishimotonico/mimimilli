import type { DataAdapter } from "../../src/adapter/index.ts";
import { createApp, type CreateAppOptions } from "../../src/app.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { SERVER_IDLE_TIMEOUT_SECONDS } from "../../src/serverLifecycle.ts";

export type FixtureTransportServer = {
  app: ReturnType<typeof createApp>;
  server: ReturnType<typeof Bun.serve>;
  adapter: DataAdapter;
  baseUrl: string;
};

export function serveFixtureTransport(
  adapter: DataAdapter = createFixtureAdapter(),
  options: CreateAppOptions = {},
): FixtureTransportServer {
  const app = createApp(adapter, options);
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: SERVER_IDLE_TIMEOUT_SECONDS,
  });
  return {
    app,
    server,
    adapter,
    baseUrl: `http://127.0.0.1:${server.port}`,
  };
}

export async function readResponseText(
  response: Response,
  predicate: (text: string) => boolean,
  timeoutMs = 10_000,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  while (!predicate(text) && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("waitFor: timeout");
}
