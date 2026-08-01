// files feature の API サーフェス。
// 物理FSブラウズ（/api/fs）と、作品配下ファイルのメディア URL（既存）を束ねる。

import { API_BASE, getParsed } from "../../shared/api/http";
import { fsListingSchema, type FsListing } from "@mimimilli/shared";

/** 物理ディレクトリを1階層ぶん列挙する。path 省略でルートフォルダー */
export async function browseFs(path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return getParsed(fsListingSchema, `/fs${q}`);
}

/** ファイルモード用: スキャンルート配下の絶対物理パスから音声をストリーミングする URL */
export function getFsAudioUrl(absolutePath: string): string {
  return `${API_BASE}/media/fs-audio?path=${encodeURIComponent(absolutePath)}`;
}

export { getFileUrl, getAudioUrl, getCoverImageUrl } from "../../entities/work/api";
