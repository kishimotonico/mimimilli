import { posix } from "node:path";
import { isSidecarMetaFileName, META_FILE_NAME, type WorkspacePath } from "@mimimilli/shared";
import { normalizeFsPath } from "./fsResolve.ts";

/** ID重複の診断が指すroot相対パス（フォルダーまたは単一ファイル形式のメタファイル）から、作品情報ファイルの絶対パスを返す */
export function identityConflictMetaPathOf(rootAbs: string, path: WorkspacePath): string {
  return metaPathOfTarget(normalizeFsPath(`${rootAbs}/${path}`));
}

export function metaPathOfTarget(target: string): string {
  return isSidecarMetaFileName(posix.basename(target))
    ? target
    : posix.join(target, META_FILE_NAME);
}
