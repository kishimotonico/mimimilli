import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { streamJobEvents, type SseSource } from "../src/lib/sseStream.ts";

type Ev = { type: string; n?: number };

function fakeSource(options: { live?: boolean; replay?: Ev[] } = {}) {
  const listeners = new Set<(event: Ev) => void>();
  let unsubscribed = 0;
  const source: SseSource<Ev> = {
    subscribe(listener) {
      listeners.add(listener);
      return {
        replay: options.replay ?? [{ type: "snapshot" }],
        live: options.live ?? true,
        unsubscribe: () => {
          unsubscribed += 1;
          listeners.delete(listener);
        },
      };
    },
    isTerminal: (event) => event.type === "end",
  };
  const emit = (event: Ev) => {
    for (const listener of listeners) listener(event);
  };
  return {
    source,
    emit,
    listenerCount: () => listeners.size,
    unsubscribedCount: () => unsubscribed,
  };
}

function appOf(source: SseSource<Ev>, heartbeatMs = 15000): Hono {
  const app = new Hono();
  app.get("/events", (c) => streamJobEvents(c, source, heartbeatMs));
  return app;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

test("replayを先頭に、emitした順にイベントを書き、終端で閉じて購読を解除する", async () => {
  const fake = fakeSource();
  const response = await appOf(fake.source).request("/events");
  const textPromise = response.text();
  await tick();
  for (let n = 0; n < 20; n++) fake.emit({ type: "code", n });
  fake.emit({ type: "end" });
  const text = await textPromise;
  const names = [...text.matchAll(/^event: (\w+)$/gm)].map((match) => match[1]);
  assert.equal(names[0], "snapshot");
  assert.equal(names.at(-1), "end");
  const order = [...text.matchAll(/"n":(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(
    order,
    Array.from({ length: 20 }, (_, index) => index),
  );
  assert.equal(fake.listenerCount(), 0);
  assert.equal(fake.unsubscribedCount() >= 1, true);
});

test("liveでない購読はreplayを送って閉じる", async () => {
  const fake = fakeSource({ live: false });
  const text = await (await appOf(fake.source).request("/events")).text();
  assert.match(text, /event: snapshot/);
  assert.equal(fake.listenerCount(), 0);
});

test("ping中に書き込みが失敗したら購読を解除する", async () => {
  const fake = fakeSource();
  const response = await appOf(fake.source, 10).request("/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  const deadline = Date.now() + 1000;
  while (fake.listenerCount() > 0 && Date.now() < deadline) await tick();
  assert.equal(fake.listenerCount(), 0);
});

test("切断の直後に終端が来てもlistenerが残らない", async () => {
  const fake = fakeSource();
  const response = await appOf(fake.source).request("/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  fake.emit({ type: "end" });
  const deadline = Date.now() + 1000;
  while (fake.listenerCount() > 0 && Date.now() < deadline) await tick();
  assert.equal(fake.listenerCount(), 0);
});
