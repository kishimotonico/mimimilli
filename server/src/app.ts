// Hono アプリの組み立て。全ルートを /api 配下にマウントし、
// notFound / onError ハンドラを shared の apiErrorSchema 形式で設定する。
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ApiError } from "@mimimilli/shared";
import { NotConfiguredError } from "./errors.ts";
import type { DataAdapter } from "./adapter/index.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";
import { axesRoute } from "./routes/axes.ts";
import { dlsiteRoute } from "./routes/dlsite.ts";
import { fsRoute } from "./routes/fs.ts";
import { mediaRoute, type MediaRouteOptions } from "./routes/media.ts";
import { scanRoute } from "./routes/scan.ts";
import { DlsiteJobManager } from "./dlsiteJobManager.ts";
import { ScanJobManager } from "./scanJobManager.ts";
import { settingsRoute } from "./routes/settings.ts";
import { smartFoldersRoute } from "./routes/smartFolders.ts";
import { tagPrefixesRoute } from "./routes/tagPrefixes.ts";
import { worksRoute } from "./routes/works.ts";
import { createStaticMiddleware } from "./staticServe.ts";

export type AppEnv = { Variables: { requestId: string } };

export type App = Hono<AppEnv> & {
  shutdown(): Promise<void>;
};

export type CreateAppOptions = { media?: MediaRouteOptions; staticDir?: string };

export function createApp(adapter: DataAdapter, options: CreateAppOptions = {}): App {
  const app = new Hono<AppEnv>();
  const httpLogger = getCategoryLogger("http");

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    c.set("requestId", requestId);
    const startedAt = performance.now();
    await next();
    const status = c.res.status;
    const properties = {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Math.round(performance.now() - startedAt),
    };
    if (status >= 500) {
      httpLogger.error("HTTPリクエストを処理しました", properties);
    } else if (status >= 400) {
      httpLogger.warn("HTTPリクエストを処理しました", properties);
    } else {
      httpLogger.debug("HTTPリクエストを処理しました", properties);
    }
  });

  const api = new Hono();
  const dlsiteJobs = new DlsiteJobManager(adapter);
  const scanJobs = new ScanJobManager(adapter);
  api.route("/", settingsRoute(adapter));
  api.route(
    "/",
    scanRoute(scanJobs, undefined, (workId) => dlsiteJobs.enqueue("new", [workId])),
  );
  api.route(
    "/",
    worksRoute(adapter, (workId) => dlsiteJobs.enqueue("new", [workId])),
  );
  api.route("/", axesRoute(adapter));
  api.route("/", tagPrefixesRoute(adapter));
  api.route("/", smartFoldersRoute(adapter));
  api.route("/", fsRoute(adapter));
  api.route("/", mediaRoute(adapter, options.media));
  api.route("/", dlsiteRoute(adapter, dlsiteJobs));

  app.route("/api", api);

  if (options.staticDir) {
    app.use("*", createStaticMiddleware(options.staticDir));
  }

  app.notFound((c) => {
    const body: ApiError = {
      error: { code: "not_found", message: `エンドポイントが見つかりません: ${c.req.path}` },
    };
    return c.json(body, 404);
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    const path = c.req.path;
    if (err instanceof HTTPException) {
      httpLogger.warn("HTTP例外が発生しました", { requestId, path, status: err.status });
      return err.getResponse();
    }
    if (err instanceof NotConfiguredError) {
      httpLogger.warn("未設定のためリクエストを拒否しました", { requestId, path, status: 409 });
      const body: ApiError = { error: { code: "conflict", message: err.message } };
      return c.json(body, 409);
    }
    httpLogger.error("リクエスト処理中にエラーが発生しました", { requestId, ...formatError(err) });
    const body: ApiError = {
      error: { code: "internal", message: "サーバー内部エラーが発生しました" },
    };
    return c.json(body, 500);
  });

  return Object.assign(app, {
    async shutdown(): Promise<void> {
      await scanJobs.shutdown();
      await dlsiteJobs.shutdown();
    },
  });
}
