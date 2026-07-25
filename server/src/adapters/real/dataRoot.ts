import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export interface DataPaths {
  root: string;
  catalogDb: string;
  userDb: string;
  dlsiteCacheDb: string;
  thumbnailCache: string;
}

/**
 * 旧単一DBの候補を決める。MIMIMILLI_DBが明示されている場合は、そのパスだけを使う。
 */
export function resolveLegacyDbPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const path = platform === "win32" ? win32 : posix;
  if (env.MIMIMILLI_DB !== undefined) {
    if (env.MIMIMILLI_DB.length === 0) {
      throw new Error("MIMIMILLI_DBが空です。旧単一DBのパスを指定してください");
    }
    const configured = path.resolve(cwd, env.MIMIMILLI_DB);
    if (!existsSync(configured)) {
      throw new Error(`MIMIMILLI_DBで指定された旧単一DBが存在しません: ${configured}`);
    }
    return configured;
  }

  const defaultPath = path.resolve(cwd, "data", "mimimilli.db");
  return existsSync(defaultPath) ? defaultPath : undefined;
}

/** ADR-0007に従ったユーザーデータ配置を返す。 */
export function resolveDataPaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  userHome: string = homedir(),
): DataPaths {
  const path = platform === "win32" ? win32 : posix;
  let root: string;
  if (env.MIMIKAGO_DATA_DIR) {
    root = path.resolve(env.MIMIKAGO_DATA_DIR);
  } else if (platform === "win32") {
    if (!env.LOCALAPPDATA) {
      throw new Error("LOCALAPPDATAが未設定のためMimikagoのデータルートを決定できません");
    }
    root = path.join(env.LOCALAPPDATA, "Mimikago");
  } else {
    const base = env.XDG_DATA_HOME || path.join(userHome, ".local", "share");
    root = path.join(path.isAbsolute(base) ? base : path.resolve(base), "mimikago");
  }

  root = path.resolve(root);
  return {
    root,
    catalogDb: path.join(root, "db", "catalog.sqlite"),
    userDb: path.join(root, "db", "user.sqlite"),
    dlsiteCacheDb: path.join(root, "db", "dlsite-cache.sqlite"),
    thumbnailCache: path.join(root, "cache", "thumbnails"),
  };
}
