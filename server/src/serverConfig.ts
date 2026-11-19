import { resolveStaticDir } from "./staticServe.ts";

export type AdapterKind = "real" | "fixture";

export interface ServerConfig {
  adapterKind: AdapterKind;
  port: number;
  mockScenario: string | undefined;
  dlsiteFetchDelayMs: number;
  thumbnailCacheDirOverride: string | undefined;
  staticDir: string | undefined;
}

function parseAdapterKind(adapterRaw: string): AdapterKind {
  if (adapterRaw === "real" || adapterRaw === "fixture") return adapterRaw;
  throw new Error(`不明な MIMIMILLI_ADAPTER です: ${adapterRaw}`);
}

export function resolveServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const adapterKind = parseAdapterKind(env.MIMIMILLI_ADAPTER ?? "real");
  const port = Number(env.PORT ?? 8080);
  const mockScenario = env.MIMIMILLI_MOCK_SCENARIO;
  const dlsiteFetchDelayMs = Number(env.MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS ?? 0);
  if (!Number.isFinite(dlsiteFetchDelayMs) || dlsiteFetchDelayMs < 0) {
    throw new Error(
      `不正な MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS です: ${env.MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS}`,
    );
  }
  const thumbnailCacheDirOverride = env.MIMIMILLI_THUMBNAIL_CACHE_DIR;
  const staticDir = resolveStaticDir(env.MIMIMILLI_STATIC_DIR);

  return {
    adapterKind,
    port,
    mockScenario,
    dlsiteFetchDelayMs,
    thumbnailCacheDirOverride,
    staticDir,
  };
}
