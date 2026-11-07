// APIへのリクエストの出所検証。127.0.0.1 bind だけに頼らず、DNSリバインディングとCSRFを塞ぐ。
// loopback は localhost・127.0.0.1・[::1]・*.localhost（RFC 6761 で loopback 固定）。ポートは見ない。
import type { MiddlewareHandler } from "hono";
import { apiError } from "./httpError.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTHORITY_PATTERN = /^[^\s/\\?#@]+$/;

export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

function isLoopbackAuthority(authority: string): boolean {
  if (!AUTHORITY_PATTERN.test(authority)) return false;
  try {
    return isLoopbackHostname(new URL(`http://${authority}`).hostname);
  } catch {
    return false;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** 全リクエストのHostがloopbackであること。Hostヘッダーが無い要求も拒否する。 */
export const requireLoopbackHost: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("Host");
  if (host === undefined || !isLoopbackAuthority(host)) {
    throw apiError("forbidden", "このHostからのリクエストは受け付けません");
  }
  await next();
};

/** 状態変更リクエストの Origin / Sec-Fetch-Site がloopback同士であること。どちらも無ければ通す。 */
export const requireSameMachineOrigin: MiddlewareHandler = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("Origin");
    const fetchSite = c.req.header("Sec-Fetch-Site");
    if ((origin !== undefined && !isLoopbackOrigin(origin)) || fetchSite === "cross-site") {
      throw apiError("forbidden", "別のサイトからのリクエストは受け付けません");
    }
  }
  await next();
};
