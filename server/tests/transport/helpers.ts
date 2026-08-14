import type { DataAdapter } from "../../src/adapter/index.ts";
import type { CreateAppOptions } from "../../src/app.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { serveMimimilli } from "../../src/serve.ts";

export type FixtureTransportServer = {
  app: ReturnType<typeof serveMimimilli>["app"];
  server: ReturnType<typeof serveMimimilli>["server"];
  adapter: DataAdapter;
  baseUrl: string;
};

export function serveFixtureTransport(
  adapter: DataAdapter = createFixtureAdapter(),
  options: CreateAppOptions = {},
): FixtureTransportServer {
  const { app, server } = serveMimimilli({ adapter, port: 0, appOptions: options });
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
