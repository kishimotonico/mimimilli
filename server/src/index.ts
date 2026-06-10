// エントリーポイント。@hono/node-server で起動する。
// env:
//   PORT             … 待受ポート（デフォルト 8080）
//   MIMIKAGO_ADAPTER … "fixture"（デフォルト） | "real"（移行プラン ステップ3で実装）
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createFixtureAdapter } from "./adapters/fixture/index.ts";
import type { DataAdapter } from "./adapter.ts";

function createAdapter(): DataAdapter {
  const kind = process.env.MIMIKAGO_ADAPTER ?? "fixture";
  switch (kind) {
    case "fixture":
      return createFixtureAdapter();
    case "real":
      throw new Error("real adapter は未実装（移行プラン ステップ3）");
    default:
      throw new Error(`不明な MIMIKAGO_ADAPTER です: ${kind}`);
  }
}

const port = Number(process.env.PORT ?? 8080);
const adapter = createAdapter();
const app = createApp(adapter);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mimikago server listening on http://localhost:${info.port} (adapter: ${process.env.MIMIKAGO_ADAPTER ?? "fixture"})`);
});
