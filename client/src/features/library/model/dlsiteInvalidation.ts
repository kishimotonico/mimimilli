import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

/**
 * DLsite連携（単発のRJコード適用・一括取得）後にどのキャッシュを無効化するか。
 *
 * `workIds`省略時（undefined）は`WORK_QUERY_KEYS.allDetails()`（`["work"]`）で
 * 全作品の詳細キャッシュを無効化する。これは実際に更新した作品が特定できない
 * 場合の安全側フォールバックとしてのみ使う（例: 一括取得ジョブの進捗イベントを
 * 一部取りこぼした可能性がある場合）。無関係な作品の詳細を開いているだけで
 * 再フェッチが走り、DLsite通知の警告ブロック挿入によるレイアウトシフトが
 * 起きる原因になっていたため、一括取得の完了時は実際に処理対象だった
 * （skippedでない）作品IDの配列を渡し、その作品の詳細キャッシュだけを
 * 無効化するようにする（DlsiteBulkRuntime.tsx参照）。
 *
 * 単発適用（DlsiteEditor.tsx）は従来どおり単一workIdまたはundefinedで呼ぶ。
 */
export function getDlsiteInvalidationKeys(workIds?: string | string[]) {
  const detailKeys =
    workIds === undefined
      ? [WORK_QUERY_KEYS.allDetails()]
      : (Array.isArray(workIds) ? workIds : [workIds]).map((id) => WORK_QUERY_KEYS.detail(id));
  return [
    WORK_QUERY_KEYS.all(),
    WORK_QUERY_KEYS.dlsiteNotifications(),
    WORK_QUERY_KEYS.allFacets(),
    TAG_QUERY_KEYS.all(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
    ...detailKeys,
  ] as const;
}
