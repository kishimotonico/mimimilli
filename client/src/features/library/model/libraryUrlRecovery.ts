// 未登録軸・存在しないスマートフォルダーIDのURLからの復帰要否を判定する純粋計算
// （TASK-428.15、監査所見 smart-folders-B-15）。React Queryの状態から切り離すことで、
// 「取得中/取得失敗中は判定しない」という条件をコンポーネントなしで検証できるようにする。

import type { SmartFolder, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import {
  getSmartFolderId,
  isFacetAxis,
  isRegisteredFacetAxis,
  isSmartAxis,
} from "../../../entities/library/axisDefinitions";

/** 無効なら警告メッセージ、有効または判定不能（取得中・取得失敗中）ならnullを返す。
 *  tagPrefixesReady/smartFoldersReadyには対応するqueryのisSuccessをそのまま渡す
 *  （取得中・取得失敗中はfalse。空配列だけでは未ロードと未登録を区別できないため）。 */
export function resolveInvalidLibraryAxisMessage(
  axis: AxisId,
  tagPrefixesReady: boolean,
  smartFoldersReady: boolean,
  tagPrefixes: TagPrefix[],
  smartFolders: SmartFolder[],
): string | null {
  if (!tagPrefixesReady || !smartFoldersReady) return null;

  if (isSmartAxis(axis)) {
    const exists = smartFolders.some((sf) => sf.id === getSmartFolderId(axis));
    return exists ? null : "指定されたスマートフォルダーが見つかりません。既定の一覧に戻りました";
  }

  if (isFacetAxis(axis) && !isRegisteredFacetAxis(axis, tagPrefixes)) {
    return "指定された絞り込み軸が見つかりません。既定の一覧に戻りました";
  }

  return null;
}
