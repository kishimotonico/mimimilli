// fixture: kind ごとのメディア解決境界（登録済み音声・未登録音声・パストラバーサル）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp, type App } from "./helpers/testApp.ts";

const WORK_ID = "RJ501001";
const REGISTERED_AUDIO = "track01.mp3";
const UNREGISTERED_AUDIO = "cover.jpg";
const TRAVERSAL_PATHS = ["..%2Fcover.jpg", "特典%2F..%2Fcover.jpg", "..%2F..%2Fetc%2Fpasswd"];

function app(): App {
  return createApp(createFixtureAdapter());
}

test("fixture: 登録済み音声は audio 経路で配信できる", async () => {
  const res = await app().request(`/api/media/audio/${WORK_ID}/${REGISTERED_AUDIO}`);
  assert.equal(res.status, 200);
});

test("fixture: 未登録の既存ファイルは audio 経路で 404", async () => {
  const res = await app().request(`/api/media/audio/${WORK_ID}/${UNREGISTERED_AUDIO}`);
  assert.equal(res.status, 404);
});

test("fixture: audio 経路のパストラバーサルは 404", async () => {
  for (const rel of TRAVERSAL_PATHS) {
    const res = await app().request(`/api/media/audio/${WORK_ID}/${rel}`);
    assert.equal(res.status, 404, `should block audio: ${rel}`);
  }
});
