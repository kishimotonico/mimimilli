// files feature の API サーフェス。
// 物理FSブラウズ（/api/fs）と、作品配下ファイルのメディア URL（既存）を束ねる。

import { getParsed } from "../../shared/api/http";
import { fsListingSchema, type FsListing } from "@mimimilli/shared";

/** 物理ディレクトリを1階層ぶん列挙する。path 省略でルートフォルダー */
export async function browseFs(path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return getParsed(fsListingSchema, `/fs${q}`);
}

export { getFileUrl, getAudioUrl, getCoverImageUrl } from "../../entities/work/api";
