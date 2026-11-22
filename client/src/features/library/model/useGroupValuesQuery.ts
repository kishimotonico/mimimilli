// 値の候補（POST /smart-folders/:id/groups）の共通フック。サイドバーのクイックオーバーレイと
// 「＋絞り込み」が同じ query キー・同じ取得ロジックを共有する。

import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { normalizeSearchQuery, type GroupBy, type NormalizedTag } from "@mimimilli/shared";
import { getSmartFolderGroups } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { assertGroupValueItems } from "./libraryPresentation";
import { groupValueSortAtom } from "./atoms";
import { toGroupSortId } from "./groupValueSort";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";

/** 候補を数える母集団。サイドバーの値一覧は絞り込み無し、「＋絞り込み」は開いている一覧の状態 */
export interface GroupValueScope {
  folderId: string;
  group?: string | null;
  tags?: NormalizedTag[];
  q?: string;
}

export function useGroupValuesQuery(groupBy: GroupBy | null, scope: GroupValueScope) {
  const { folderId, group = null, tags = [], q = "" } = scope;
  const groupSort = toGroupSortId(useAtomValue(groupValueSortAtom));
  const filter = { group, tags, q: normalizeSearchQuery(q), groupSort };
  return useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.groups(
      folderId,
      groupBy === null ? "" : groupByKey(groupBy),
      filter,
    ),
    queryFn: async () => {
      const items = await getSmartFolderGroups(folderId, {
        groupBy: groupBy!,
        ...filter,
      });
      return assertGroupValueItems(groupBy!, items);
    },
    enabled: groupBy !== null,
  });
}
