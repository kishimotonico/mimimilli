// root再設定（ADR-0029）の操作ロックmiddleware。単体でテストできるよう
// Hono/DataAdapterから切り離した最小のインターフェースで受け取る。
import type { MiddlewareHandler } from "hono";
import { RootReconfiguringError } from "../errors.ts";
import type { InFlightRequestGate } from "./inFlightRequestGate.ts";

export interface RootReconfigurationLockMiddlewareOptions {
  isAllowed: (method: string, path: string) => boolean;
  isLocked: () => Promise<boolean>;
  gate: InFlightRequestGate;
}

/**
 * 非許可リクエストはisLocked()の判定より先にgateへenterする。isLocked()は
 * adapter読み出しでawaitするため、先にロック判定だけ行うとその待ち時間中に
 * root再設定の開始処理がロックを確立してdrainを完了させてしまい、この要求が
 * enterする前にすり抜ける（TOCTOU）。開始処理がロックを同期的に確立することに
 * 依存する。
 */
export function createRootReconfigurationLockMiddleware(
  options: RootReconfigurationLockMiddlewareOptions,
): MiddlewareHandler {
  return async (c, next) => {
    if (options.isAllowed(c.req.method, c.req.path)) {
      await next();
      return;
    }
    options.gate.enter();
    try {
      if (await options.isLocked()) {
        throw new RootReconfiguringError();
      }
      await next();
    } finally {
      options.gate.leave();
    }
  };
}
