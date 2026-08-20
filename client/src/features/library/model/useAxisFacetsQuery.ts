// 軸の値一覧データ取得（GET /axes/:axis）の共通フック。値一覧本体（AxisValueList）と
// クイックオーバーレイ・チップドロップダウンが同じ query キー・同じ取得ロジックを
// 共有するために切り出す（軸レール以外の任意の軸も問い合わせられる）。

import { useQuery } from "@tanstack/react-query";
import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import { getAxisFacets } from "../api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { buildAxisFacetFilterParams, filterValidFacetItems } from "./libraryPresentation";

// selectedTags は自軸除外カウントの入力。省略時（[]）は無フィルタ集計になる
// （呼び出し側が保持中のフィルタを意図的に渡さない場面は無い想定だが、型上は必須にしない）。
export function useAxisFacetsQuery(axis: FacetAxisId | null, selectedTags: NormalizedTag[] = []) {
  const filterParams = axis !== null ? buildAxisFacetFilterParams(axis, selectedTags) : {};
  return useQuery({
    queryKey: WORK_QUERY_KEYS.facets(axis ?? "", filterParams),
    queryFn: async () => {
      const items = await getAxisFacets(axis!, filterParams);
      return filterValidFacetItems(axis!, items);
    },
    enabled: axis !== null,
  });
}
