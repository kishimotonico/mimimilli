// スキャン進捗のリアルタイム通知（TASK-20）: POST /scan の互換性維持と
// GET /scan/events の SSE 配信・接続断/再接続時の挙動を検証する。
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { resetScanProgressStateForTest } from "../src/routes/scanProgress.ts";

interface SseFrame {
  event: string;
  data: string;
}

/** SSE ストリームを読み、predicate が true を返すイベントに到達したら購読をやめて返す */
async function readSseUntil(
  res: Response,
  predicate: (frame: SseFrame) => boolean,
  maxFrames = 50,
): Promise<SseFrame[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: SseFrame[] = [];

  while (frames.length < maxFrames) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawFrame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let event = "message";
      const dataLines: string[] = [];
      for (const line of rawFrame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice("event:".length).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
      }
      const frame: SseFrame = { event, data: dataLines.join("\n") };
      frames.push(frame);
      if (predicate(frame)) {
        await reader.cancel();
        return frames;
      }
    }
  }
  return frames;
}

beforeEach(() => {
  resetScanProgressStateForTest();
});

test("POST /scan は従来どおり完了まで待って ScanResult を返す（互換性維持）", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  const res = await app.request("/api/scan", { method: "POST" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.newWorkIds, ["RJ501011"]);
});

test("GET /scan/events: スキャン実行中に接続すると progress → complete の順でイベントが届く", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));

  const scanPromise = app.request("/api/scan", { method: "POST" });
  // POST 側の起動（startScanJob）がスキャン処理内の最初の await より先に走るよう1tick待つ
  await new Promise((r) => setTimeout(r, 0));

  const eventsRes = await app.request("/api/scan/events");
  assert.equal(eventsRes.status, 200);
  assert.match(eventsRes.headers.get("content-type") ?? "", /text\/event-stream/);

  const frames = await readSseUntil(eventsRes, (f) => f.event === "complete");
  assert.ok(
    frames.some((f) => f.event === "progress"),
    "progress イベントが届くこと",
  );

  const completeFrame = frames.find((f) => f.event === "complete")!;
  const completePayload = JSON.parse(completeFrame.data);
  assert.equal(completePayload.type, "complete");
  assert.deepEqual(completePayload.result.newWorkIds, ["RJ501011"]);

  const scanRes = await scanPromise;
  assert.equal(scanRes.status, 200);
});

test("GET /scan/events: スキャンが実行中でない場合、直近の complete を1件だけ replay してすぐ閉じる（再接続時の挙動）", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));

  // 1回スキャンを完了させておく
  await app.request("/api/scan", { method: "POST" });

  // 完了後に（再接続を模して）新規に接続 → 直近の complete が即座に replay され、ストリームが閉じる
  const eventsRes = await app.request("/api/scan/events");
  const frames = await readSseUntil(eventsRes, () => false);

  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.event, "complete");
});

test("GET /scan/events: 一度もスキャンしていない場合は replay するイベントが無いまま閉じる", async () => {
  const app = createApp(createFixtureAdapter());

  const eventsRes = await app.request("/api/scan/events");
  const frames = await readSseUntil(eventsRes, () => false);

  assert.equal(frames.length, 0);
});

test("POST /scan: 実行中に重ねて呼ぶと 409 conflict", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));

  const first = app.request("/api/scan", { method: "POST" });
  await new Promise((r) => setTimeout(r, 0));

  const second = await app.request("/api/scan", { method: "POST" });
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.equal(body.error.code, "conflict");

  await first;
});

test("GET /scan/events: 接続が切れて再接続しても、直近の progress を replay してから続行する", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));

  const scanPromise = app.request("/api/scan", { method: "POST" });
  await new Promise((r) => setTimeout(r, 0));

  // 1本目の接続: 最初の progress を1件受け取ったら（切断を模して）打ち切る
  const firstConn = await app.request("/api/scan/events");
  const firstFrames = await readSseUntil(firstConn, (f) => f.event === "progress");
  assert.ok(firstFrames.length >= 1);

  // 2本目の接続（再接続）: 直近の progress が replay され、その後 complete まで届く
  const secondConn = await app.request("/api/scan/events");
  const secondFrames = await readSseUntil(secondConn, (f) => f.event === "complete");
  assert.equal(secondFrames[0]!.event, "progress");
  assert.ok(secondFrames.some((f) => f.event === "complete"));

  await scanPromise;
});
