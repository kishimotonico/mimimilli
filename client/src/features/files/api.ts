// files feature の API サーフェス。
// 物理FSブラウズ（/api/fs）と、作品配下ファイルのメディア URL（既存）を束ねる。

import { get } from "../../shared/api/http";
import type { FsListing } from "./model/types";

/** 物理ディレクトリを1階層ぶん列挙する。path 省略でルートフォルダー */
export async function browseFs(path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return get<FsListing>(`/fs${q}`);
}

export { getFileUrl, getAudioUrl, getCoverImageUrl } from "../../entities/work/api";
