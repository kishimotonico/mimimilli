export interface DlsiteRequestConfig {
  offline: boolean;
  requestIntervalMs: number;
  retryCount: number;
  maxBackoffMs: number;
  timeoutMs: number;
}

export const DEFAULT_DLSITE_REQUEST_CONFIG: DlsiteRequestConfig = {
  offline: false,
  requestIntervalMs: 1_000,
  retryCount: 3,
  maxBackoffMs: 30_000,
  timeoutMs: 60_000,
};
export const MAX_DLSITE_TIMER_MS = 2_147_483_647;

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} は true または false で指定してください`);
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
): number {
  if (value === undefined) return fallback;
  if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new Error(`${name} は整数で指定してください`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > MAX_DLSITE_TIMER_MS) {
    throw new Error(
      `${name} は ${minimum} 以上 ${MAX_DLSITE_TIMER_MS} 以下の整数で指定してください`,
    );
  }
  return parsed;
}

/** DLsite実HTTPの設定を環境変数から厳格に読み取る。 */
export function resolveDlsiteRequestConfig(
  env: Record<string, string | undefined> = process.env,
): DlsiteRequestConfig {
  return {
    offline: parseBoolean(
      "MIMIMILLI_DLSITE_OFFLINE",
      env.MIMIMILLI_DLSITE_OFFLINE,
      DEFAULT_DLSITE_REQUEST_CONFIG.offline,
    ),
    requestIntervalMs: parseInteger(
      "MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS",
      env.MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS,
      DEFAULT_DLSITE_REQUEST_CONFIG.requestIntervalMs,
      0,
    ),
    retryCount: parseInteger(
      "MIMIMILLI_DLSITE_RETRY_COUNT",
      env.MIMIMILLI_DLSITE_RETRY_COUNT,
      DEFAULT_DLSITE_REQUEST_CONFIG.retryCount,
      0,
    ),
    maxBackoffMs: parseInteger(
      "MIMIMILLI_DLSITE_MAX_BACKOFF_MS",
      env.MIMIMILLI_DLSITE_MAX_BACKOFF_MS,
      DEFAULT_DLSITE_REQUEST_CONFIG.maxBackoffMs,
      0,
    ),
    timeoutMs: parseInteger(
      "MIMIMILLI_DLSITE_TIMEOUT_MS",
      env.MIMIMILLI_DLSITE_TIMEOUT_MS,
      DEFAULT_DLSITE_REQUEST_CONFIG.timeoutMs,
      1,
    ),
  };
}
