// files feature の API サーフェス。
// 物理FSブラウズ（/api/fs）と、作品配下ファイルのメディア URL（既存）を束ねる。

import {
  dlsiteWorkInfoSchema,
  workCreateResponseSchema,
  workRegisterPreviewSchema,
  type DlsiteWorkInfo,
  type Work,
  type WorkCreateBodyInput,
  type WorkRegisterPreview,
} from "@mimimilli/shared";
import { API_BASE, getParsed, postParsed, deleteVoid } from "../../shared/api/http";
import { fsListingSchema, type FsListing } from "@mimimilli/shared";

/** 物理ディレクトリを1階層ぶん列挙する。path 省略でルートフォルダー */
export async function browseFs(path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return getParsed(fsListingSchema, `/fs${q}`);
}

/** 作品登録前のプレビュー（タイトル候補・RJコード・子作品数） */
export async function getWorkRegisterPreview(path: string): Promise<WorkRegisterPreview> {
  const q = `?path=${encodeURIComponent(path)}`;
  return getParsed(workRegisterPreviewSchema, `/works/register-preview${q}`);
}

/** フォルダーを作品として登録する */
export async function createWork(body: WorkCreateBodyInput): Promise<Work> {
  return postParsed(workCreateResponseSchema, "/works", body);
}

/** 作品登録を解除する（DB・メタファイルのみ。物理ファイルは残す） */
export async function deleteWork(workId: string): Promise<void> {
  await deleteVoid(`/works/${encodeURIComponent(workId)}`);
}

/** 作品未登録時の DLsite メタ取得（RJ/VJコード指定） */
export async function fetchDlsiteInfoByCode(rjCode: string): Promise<DlsiteWorkInfo> {
  return postParsed(dlsiteWorkInfoSchema, "/dlsite/fetch-by-code", { rjCode });
}

/** ファイルモード用: スキャンルート配下の絶対物理パスから音声をストリーミングする URL */
export function getFsAudioUrl(absolutePath: string): string {
  return `${API_BASE}/media/fs-audio?path=${encodeURIComponent(absolutePath)}`;
}

export { getFileUrl, getAudioUrl, getCoverImageUrl } from "../../entities/work/api";
