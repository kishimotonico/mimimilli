// 値の候補（GET /smart-folders/:id/groups）の共通フック。値一覧・クイックオーバーレイ・
// パンくずの値・「＋絞り込み」が同じ取得ロジックを共有し、母集団が同じなら query キーも共有する。

import { useQuery } from "@tanstack/react-query";
import {
  normalizeSearchQuery,
  type GroupBy,
  type GroupSortId,
  type NormalizedTag,
} from "@mimimilli/shared";
import { getSmartFolderGroups } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { assertGroupValueItems } from "./libraryPresentation";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";

/** 候補を数える母集団。サイドバーのクイックオーバーレイは絞り込み無し、ほかは開いている一覧のチップと検索語 */
export interface GroupValueScope {
  folderId: string;
  group?: string | null;
  tags?: NormalizedTag[];
  q?: string;
}

export function useGroupValuesQuery(
  groupBy: GroupBy | null,
  scope: GroupValueScope,
  /** null なら取得しない */
  groupSort: GroupSortId | null,
  /** 検索語・チップが変わる間、同じ行の前の結果を出したままにする（入力のたびに一覧が空にならない） */
  { keepPrevious = false }: { keepPrevious?: boolean } = {},
) {
  const { folderId, group = null, tags = [], q = "" } = scope;
  const filter = { group, tags, q: normalizeSearchQuery(q), groupSort };
  return useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.groups(folderId, groupByKey(groupBy), filter),
    queryFn: async () => {
      const items = await getSmartFolderGroups(folderId, {
        groupBy: groupBy!,
        ...filter,
        groupSort: groupSort!,
      });
      return assertGroupValueItems(groupBy!, items);
    },
    enabled: groupBy !== null && groupSort !== null,
    placeholderData: keepPrevious
      ? (previous, previousQuery) =>
          previousQuery?.queryKey[1] === folderId &&
          previousQuery.queryKey[2] === groupByKey(groupBy)
            ? previous
            : undefined
      : undefined,
  });
}
