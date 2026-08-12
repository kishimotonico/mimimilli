// file-system entity の API。物理 FS のメディア URL を扱う。
// 依存方向: shared/api/http のみを参照する。

import { API_BASE } from "../../shared/api/http";
import type { WorkspacePath } from "@mimimilli/shared";

/** ファイルモード用: スキャンルート相対パスのメディア URL */
export function getWorkspaceMediaUrl(path: WorkspacePath): string {
  return `${API_BASE}/media/workspace?path=${encodeURIComponent(path)}`;
}
