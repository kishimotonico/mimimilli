// 値の候補（POST /smart-folders/:id/groups）の共通フック。サイドバーのクイックオーバーレイと
// 「＋絞り込み」が同じ query キー・同じ取得ロジックを共有する。

import { useQuery } from "@tanstack/react-query";
import type { GroupBy, NormalizedTag } from "@mimimilli/shared";
import { getSmartFolderGroups } from "../../../entities/smart-folder/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { assertGroupValueItems } from "./libraryPresentation";
import { groupByKey } from "./smartFolderEditing";

/** 候補を数える母集団。サイドバーの値一覧は絞り込み無し、「＋絞り込み」は開いている一覧の状態 */
export interface GroupValueScope {
  folderId: string;
  group?: string | null;
  tags?: NormalizedTag[];
  q?: string;
}

export function useGroupValuesQuery(groupBy: GroupBy | null, scope: GroupValueScope) {
  const { folderId, group = null, tags = [], q = "" } = scope;
  const filter = { group, tags, q };
  return useQuery({
    queryKey: WORK_QUERY_KEYS.scopedGroupValues(
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
