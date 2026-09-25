// files feature の API サーフェス。
// 物理FSブラウズ（/api/fs）と、作品配下ファイルのメディア URL（既存）を束ねる。

import {
  dlsiteWorkInfoSchema,
  scanDiagnosticsResponseSchema,
  workRegisterPreviewSchema,
  type DlsiteWorkInfo,
  type WorkRegisterPreview,
  type WorkspacePath,
} from "@mimimilli/shared";
import { getParsed, postParsed } from "../../shared/api/http";
import { fsListingSchema, type FsListing } from "@mimimilli/shared";

/** 物理ディレクトリを1階層ぶん列挙する。path 省略でルートフォルダー */
export async function browseFs(path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return getParsed(fsListingSchema, `/fs${q}`);
}

/** 作品登録前のプレビュー（タイトル候補・RJコード・子作品数） */
export async function getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview> {
  const q = `?path=${encodeURIComponent(path)}`;
  return getParsed(workRegisterPreviewSchema, `/works/register-preview${q}`);
}

export async function getScanDiagnostics() {
  return getParsed(scanDiagnosticsResponseSchema, "/scan/diagnostics");
}

/** 作品未登録時の DLsite メタ取得（RJ/VJコード指定） */
export async function fetchDlsiteInfoByCode(rjCode: string): Promise<DlsiteWorkInfo> {
  return postParsed(dlsiteWorkInfoSchema, "/dlsite/fetch-by-code", { rjCode });
}
