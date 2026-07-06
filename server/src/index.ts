// エントリーポイント。@hono/node-server で起動する。
// env:
//   PORT                    … 待受ポート（デフォルト 8080）
//   MIMIMILLI_ADAPTER       … "real"（デフォルト） | "fixture"（インメモリ開発データ）
//   MIMIMILLI_DB            … real アダプタの SQLite パス（デフォルト ./data/mimimilli.db）
//   MIMIMILLI_MOCK_SCENARIO … fixture アダプタのデータシナリオ
//                             ("default" | "empty" | "new-work" | "errors"、省略時 "default")
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createFixtureAdapter } from "./adapters/fixture/index.ts";
import { createRealAdapter } from "./adapters/real/index.ts";
import type { DataAdapter } from "./adapter.ts";

const adapterKind = process.env.MIMIMILLI_ADAPTER ?? "real";

function createAdapter(): DataAdapter {
  switch (adapterKind) {
    case "fixture":
      return createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
    case "real":
      return createRealAdapter({ dbPath: process.env.MIMIMILLI_DB ?? "data/mimimilli.db" });
    default:
      throw new Error(`不明な MIMIMILLI_ADAPTER です: ${adapterKind}`);
  }
}

const port = Number(process.env.PORT ?? 8080);
const adapter = createAdapter();
const app = createApp(adapter);

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(
    `mimimilli server listening on http://localhost:${info.port} (adapter: ${adapterKind})`,
  );
});
