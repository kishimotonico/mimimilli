// 値の候補（POST /smart-folders/:id/groups）の共通フック。サイドバーのクイックオーバーレイと
// 「＋絞り込み」が同じ query キー・同じ取得ロジックを共有する。

import { useQuery } from "@tanstack/react-query";
import type { NormalizedTag } from "@mimimilli/shared";
import { getSmartFolderGroups } from "../../../entities/smart-folder/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import type { AxisId } from "../../../entities/library/types";
import { filterValidFacetItems, groupByOfAxis } from "./libraryPresentation";

/** 候補を数える母集団。サイドバーの値一覧は絞り込み無し、「＋絞り込み」は開いている一覧の状態 */
export interface FacetScope {
  folderId: string;
  group?: string | null;
  tags?: NormalizedTag[];
  q?: string;
}

export function useAxisFacetsQuery(axis: AxisId | null, scope: FacetScope) {
  const { folderId, group = null, tags = [], q = "" } = scope;
  const filter = { group, tags, q };
  return useQuery({
    queryKey: WORK_QUERY_KEYS.scopedFacets(folderId, axis ?? "", filter),
    queryFn: async () => {
      const items = await getSmartFolderGroups(folderId, {
        groupBy: groupByOfAxis(axis!),
        ...filter,
      });
      return filterValidFacetItems(axis!, items);
    },
    enabled: axis !== null,
  });
}
