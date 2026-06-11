// Hono アプリの組み立て。全ルートを /api 配下にマウントし、
// notFound / onError ハンドラを shared の apiErrorSchema 形式で設定する。
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ApiError } from "@mimikago/shared";
import { NotConfiguredError, type DataAdapter } from "./adapter.ts";
import { axesRoute } from "./routes/axes.ts";
import { dlsiteRoute } from "./routes/dlsite.ts";
import { fsRoute } from "./routes/fs.ts";
import { mediaRoute } from "./routes/media.ts";
import { presetsRoute } from "./routes/presets.ts";
import { scanRoute } from "./routes/scan.ts";
import { settingsRoute } from "./routes/settings.ts";
import { smartFoldersRoute } from "./routes/smartFolders.ts";
import { worksRoute } from "./routes/works.ts";

export function createApp(adapter: DataAdapter): Hono {
  const app = new Hono();

  const api = new Hono();
  api.route("/", settingsRoute(adapter));
  api.route("/", scanRoute(adapter));
  api.route("/", worksRoute(adapter));
  api.route("/", axesRoute(adapter));
  api.route("/", smartFoldersRoute(adapter));
  api.route("/", presetsRoute(adapter));
  api.route("/", fsRoute(adapter));
  api.route("/", mediaRoute(adapter));
  api.route("/", dlsiteRoute(adapter));

  app.route("/api", api);

  app.notFound((c) => {
    const body: ApiError = { error: { code: "not_found", message: `エンドポイントが見つかりません: ${c.req.path}` } };
    return c.json(body, 404);
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    if (err instanceof NotConfiguredError) {
      const body: ApiError = { error: { code: "conflict", message: err.message } };
      return c.json(body, 409);
    }
    console.error(err);
    const body: ApiError = { error: { code: "internal", message: "サーバー内部エラーが発生しました" } };
    return c.json(body, 500);
  });

  return app;
}
