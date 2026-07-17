// DLsiteタイトル適用ポリシーの判定（一括取得 mode="existing" 用）。
// スキャナーは新規作品のタイトルをフォルダー名のまま登録する（scanner.ts の
// generateMetaForFolder）ため、「フォルダー名のまま」または「RJコードのまま」の
// タイトルはユーザー未編集とみなし、DLsiteタイトルで上書きしてよいと判定する。
// それ以外はユーザーが手動編集したとみなし、判定対象から外す（呼び出し側で保護する）。
import { basename } from "node:path";

/** タイトルがスキャン直後の初期値（フォルダー名またはRJコードそのもの）のままか判定する */
export function isDefaultTitle(
  title: string,
  physicalPath: string,
  rjCode: string | null,
): boolean {
  const normalized = title.toLowerCase();
  if (normalized === basename(physicalPath).toLowerCase()) return true;
  if (rjCode !== null && normalized === rjCode.toLowerCase()) return true;
  return false;
}
