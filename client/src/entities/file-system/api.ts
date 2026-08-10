// file-system entity の API。物理 FS のメディア URL を扱う。
// 依存方向: shared/api/http のみを参照する。

import { API_BASE } from "../../shared/api/http";

/** ファイルモード用: スキャンルート配下の絶対物理パスから音声をストリーミングする URL */
export function getFsAudioUrl(absolutePath: string): string {
  return `${API_BASE}/media/fs-audio?path=${encodeURIComponent(absolutePath)}`;
}
