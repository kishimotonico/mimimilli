// 登録プレビューのうち、対象の名前だけから決まる規則。real/fixture 両adapterが共有する。
import { detectRjCode } from "@mimimilli/shared";

export interface RegisterPreviewNaming {
  suggestedTitle: string;
  detectedRjCode: string | null;
}

/** フォルダー作品: タイトル候補はフォルダー名、RJコードはフォルダー名から検出する。 */
export function folderRegisterNaming(folderName: string): RegisterPreviewNaming {
  return { suggestedTitle: folderName, detectedRjCode: detectRjCode([folderName]) };
}

/** 単一ファイル作品: タイトル候補は拡張子を除いたファイル名、RJコードはファイル名・語幹の順に検出する。 */
export function fileRegisterNaming(fileName: string): RegisterPreviewNaming {
  const stem = fileName.replace(/\.[^.]+$/, "");
  return { suggestedTitle: stem, detectedRjCode: detectRjCode([fileName, stem]) };
}
