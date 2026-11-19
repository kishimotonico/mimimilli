import type { DlsiteCachedCover } from "@mimimilli/shared";
import { API_BASE } from "../../shared/api/http";

/** サーバーのDLsiteキャッシュにあるカバーのURL（<img src> で直接使用可）。DLsiteのURLは使わない。 */
export function getDlsiteCoverUrl(cover: DlsiteCachedCover): string {
  return `${API_BASE}/media/dlsite-cover/${cover.key}?v=${cover.version}`;
}
