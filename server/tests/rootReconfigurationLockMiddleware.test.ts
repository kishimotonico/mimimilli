// isLocked()の待ち中にroot再設定が開始されても、受理済みリクエストがgateへ
// enterするより前にすり抜けない（TOCTOU）ことを縛る。
import assert from "node:assert/strict";
import type { Context } from "hono";
import { test } from "node:test";
import { InFlightRequestGate } from "../src/lib/inFlightRequestGate.ts";
import { createRootReconfigurationLockMiddleware } from "../src/lib/rootReconfigurationLockMiddleware.ts";
import { RootReconfiguringError } from "../src/errors.ts";

function fakeContext(method: string, path: string): Context {
  return { req: { method, path } } as unknown as Context;
}

test("isLockedの待ち中でも要求は先にgateへenterし、drainに待たれる", async () => {
  const gate = new InFlightRequestGate();
  let resolveIsLocked: ((locked: boolean) => void) | undefined;
  const isLocked = () =>
    new Promise<boolean>((resolve) => {
      resolveIsLocked = resolve;
    });
  const middleware = createRootReconfigurationLockMiddleware({
    isAllowed: () => false,
    isLocked,
    gate,
  });

  let nextCalled = false;
  const requestPromise = middleware(fakeContext("POST", "/api/scan"), async () => {
    nextCalled = true;
  });

  // isLocked()がpending中でも、drainはこの要求がleaveするまで解決しない。
  let drained = false;
  const drainPromise = gate.drain().then(() => {
    drained = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(drained, false);

  resolveIsLocked?.(false);
  await requestPromise;
  assert.equal(nextCalled, true);
  await drainPromise;
  assert.equal(drained, true);
});

test("isLockedの待ち中に開始されていれば、trueが返って409相当のエラーで弾かれる", async () => {
  const gate = new InFlightRequestGate();
  let resolveIsLocked: ((locked: boolean) => void) | undefined;
  const isLocked = () =>
    new Promise<boolean>((resolve) => {
      resolveIsLocked = resolve;
    });
  const middleware = createRootReconfigurationLockMiddleware({
    isAllowed: () => false,
    isLocked,
    gate,
  });

  const requestPromise = middleware(fakeContext("POST", "/api/scan"), async () => {});
  resolveIsLocked?.(true);

  await assert.rejects(requestPromise, RootReconfiguringError);
  await gate.drain();
});

test("許可リストの要求はgateへenterせず、drainを待たせない", async () => {
  const gate = new InFlightRequestGate();
  const middleware = createRootReconfigurationLockMiddleware({
    isAllowed: () => true,
    isLocked: () => Promise.resolve(true),
    gate,
  });

  let nextCalled = false;
  await middleware(fakeContext("GET", "/api/settings"), async () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  await gate.drain();
});
