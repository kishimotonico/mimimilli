// 軸の値一覧データ取得（GET /axes/:axis）の共通フック。値一覧本体（AxisValueList）と
// クイックオーバーレイ・チップドロップダウンが同じ query キー・同じ取得ロジックを
// 共有するために切り出す（軸レール以外の任意の軸も問い合わせられる）。

import { useQuery } from "@tanstack/react-query";
import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import { getAxisFacets } from "../api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { buildTagFilterParams, filterValidFacetItems } from "./libraryPresentation";

// selectedTags は集計に含めるタグ。件数基準（何を含めて集計するか）は呼び出し側の責務で、
// 値選択の契約（valueSelectionContract.ts の deriveFacetCountTags）から導出する。
// このフック自体は渡されたタグをそのままAND条件として渡すだけで、軸やintentを見ない。
//
// smartFolderId はスマートフォルダー表示中だけ渡す。生のルールではなくIDをサーバーへ渡し、
// フォルダー条件適用後の集合を集計元にする（TASK-432）。
export function useAxisFacetsQuery(
  axis: FacetAxisId | null,
  selectedTags: NormalizedTag[] = [],
  smartFolderId?: string,
) {
  const filterParams = {
    ...buildTagFilterParams(selectedTags),
    ...(smartFolderId ? { smartFolderId } : {}),
  };
  return useQuery({
    queryKey: WORK_QUERY_KEYS.facets(axis ?? "", filterParams),
    queryFn: async () => {
      const items = await getAxisFacets(axis!, filterParams);
      return filterValidFacetItems(axis!, items);
    },
    enabled: axis !== null,
  });
}
