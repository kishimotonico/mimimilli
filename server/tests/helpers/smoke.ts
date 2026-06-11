// real アダプタの手動スモーク（node tests/helpers/smoke.ts で実行）。
// 一時ライブラリを生成し、設定 → スキャン → 検索 → fs → メディア（Range）まで一気に確認する。
import { createApp } from "../../src/app.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary } from "./sampleLibrary.ts";

const { root } = makeSampleLibrary("data/smoke");
const adapter = createRealAdapter({ dbPath: ":memory:" });
const app = createApp(adapter);

async function json(path: string, init?: RequestInit) {
  const res = await app.request(path, init);
  return { status: res.status, body: await res.json() };
}

console.log("== settings ==", await json("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rootFolder: root }) }));
console.log("== scan ==", JSON.stringify(await json("/api/scan", { method: "POST" })));
const works = await json("/api/works?sort=title-asc");
console.log("== works ==", JSON.stringify(works.body, null, 1).slice(0, 1200));
const errWork = await json("/api/works?view=missing");
console.log("== missing view ==", JSON.stringify(errWork.body));
console.log("== axes/cv ==", JSON.stringify(await json("/api/axes/cv")));
console.log("== fs ==", JSON.stringify((await json(`/api/fs?path=${encodeURIComponent(root + "/dlsite")}`)).body).slice(0, 600));

// 自動生成された作品のメディア配信（Range）
const generated = (works.body as { items: { id: string; title: string }[] }).items.find((w) => w.title.includes("RJ900001"));
if (generated) {
  const res = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, { headers: { Range: "bytes=0-99" } });
  console.log("== range ==", res.status, res.headers.get("content-range"), res.headers.get("content-type"));
  const trav = await app.request(`/api/media/file/${generated.id}/..%2F..%2F..%2F..%2Fetc%2Fpasswd`);
  console.log("== traversal ==", trav.status);
}

// 2回目スキャン（冪等性 + 移動なしの突合）
console.log("== rescan ==", JSON.stringify(await json("/api/scan", { method: "POST" })));
