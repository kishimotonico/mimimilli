import assert from "node:assert/strict";
import { test } from "node:test";
import { InFlightRequestGate } from "../src/lib/inFlightRequestGate.ts";

test("InFlightRequestGate: 誰もenterしていなければdrainは即解決する", async () => {
  const gate = new InFlightRequestGate();
  await gate.drain();
});

test("InFlightRequestGate: enter中のdrainはleaveされるまで解決しない", async () => {
  const gate = new InFlightRequestGate();
  gate.enter();
  let drained = false;
  const drainPromise = gate.drain().then(() => {
    drained = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(drained, false);
  gate.leave();
  await drainPromise;
  assert.equal(drained, true);
});

test("InFlightRequestGate: 複数enterは全てleaveされるまでdrainしない", async () => {
  const gate = new InFlightRequestGate();
  gate.enter();
  gate.enter();
  let drained = false;
  const drainPromise = gate.drain().then(() => {
    drained = true;
  });
  gate.leave();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(drained, false);
  gate.leave();
  await drainPromise;
  assert.equal(drained, true);
});
