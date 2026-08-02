import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export interface DataPaths {
  root: string;
  catalogDb: string;
  userDb: string;
  dlsiteCacheDb: string;
  thumbnailCache: string;
  logDir: string;
  backupDir: string;
}

/** ADR-0007に従ったユーザーデータ配置を返す。 */
export function resolveDataPaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  userHome: string = homedir(),
): DataPaths {
  const path = platform === "win32" ? win32 : posix;
  let root: string;
  if (env.MIMIMILLI_DATA_DIR) {
    root = path.resolve(env.MIMIMILLI_DATA_DIR);
  } else if (platform === "win32") {
    if (!env.LOCALAPPDATA) {
      throw new Error("LOCALAPPDATAが未設定のためMimimilliのデータルートを決定できません");
    }
    root = path.join(env.LOCALAPPDATA, "mimimilli");
  } else {
    const base = env.XDG_DATA_HOME || path.join(userHome, ".local", "share");
    root = path.join(path.isAbsolute(base) ? base : path.resolve(base), "mimimilli");
  }

  root = path.resolve(root);
  return {
    root,
    catalogDb: path.join(root, "db", "catalog.sqlite"),
    userDb: path.join(root, "db", "user.sqlite"),
    dlsiteCacheDb: path.join(root, "db", "dlsite-cache.sqlite"),
    thumbnailCache: path.join(root, "cache", "thumbnails"),
    logDir: path.join(root, "log"),
    backupDir: path.join(root, "backup"),
  };
}
