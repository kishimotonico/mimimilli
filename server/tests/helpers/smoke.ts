// real アダプタの手動スモーク（`pnpm smoke:real`、実体は bun tests/helpers/smoke.ts）。
// 一時ライブラリを生成し、root再設定 → スキャン → 検索 → fs → メディア（Range）まで一気に確認する。
import { createApp } from "./testApp.ts";
import { pollUntil } from "./poll.ts";
import { createTestRealAdapter } from "./realAdapter.ts";
import { makeSampleLibrary } from "./sampleLibrary.ts";

const { root, cleanup } = makeSampleLibrary();
const adapter = createTestRealAdapter({ database: { kind: "memory" } });
const app = createApp(adapter);

try {
  async function json(path: string, init?: RequestInit) {
    const res = await app.request(path, init);
    return { status: res.status, body: await res.json() };
  }

  console.log(
    "== root-reconfiguration ==",
    await json("/api/root-reconfiguration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootFolder: root }),
    }),
  );
  await pollUntil(async () => (await json("/api/root-reconfiguration")).body.status !== "running");
  console.log("== settings ==", await json("/api/settings"));
  console.log("== scan ==", JSON.stringify(await json("/api/scan", { method: "POST" })));
  const works = await json("/api/smart-folders/all/works?sort=title-asc");
  console.log("== works ==", JSON.stringify(works.body, null, 1).slice(0, 1200));
  const errWork = await json("/api/smart-folders/error/works?sort=added-desc");
  console.log("== error view ==", JSON.stringify(errWork.body));
  console.log(
    "== groups/cv ==",
    JSON.stringify(
      await json("/api/smart-folders/all/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupBy: { kind: "prefix", prefix: "cv" } }),
      }),
    ),
  );
  console.log("== fs ==", JSON.stringify((await json(`/api/fs?path=dlsite`)).body).slice(0, 600));

  // 自動生成された作品のメディア配信（Range）
  const generated = (works.body as { items: { id: string; title: string }[] }).items.find((w) =>
    w.title.includes("RJ900001"),
  );
  if (generated) {
    const res = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
      headers: { Range: "bytes=0-99" },
    });
    console.log(
      "== range ==",
      res.status,
      res.headers.get("content-range"),
      res.headers.get("content-type"),
    );
    const trav = await app.request(
      `/api/media/audio/${generated.id}/..%2F..%2F..%2F..%2Fetc%2Fpasswd`,
    );
    console.log("== traversal ==", trav.status);
  }

  // 2回目スキャン（冪等性 + 移動なしの突合）
  console.log("== rescan ==", JSON.stringify(await json("/api/scan", { method: "POST" })));
} finally {
  await adapter.close();
  await cleanup();
}
