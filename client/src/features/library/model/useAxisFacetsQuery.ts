// 軸の値一覧データ取得（GET /axes/:axis）の共通フック。値一覧本体（AxisValueList）と
// クイックオーバーレイ・チップドロップダウン（TASK-182）が同じ query キー・同じ取得ロジックを
// 共有するために切り出す（軸レール以外の任意の軸も問い合わせられる）。

import { useQuery } from "@tanstack/react-query";
import type { FacetAxisId } from "@mimimilli/shared";
import { getAxisFacets } from "../api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

export function useAxisFacetsQuery(axis: FacetAxisId | null) {
  return useQuery({
    queryKey: WORK_QUERY_KEYS.facets(axis ?? ""),
    queryFn: () => getAxisFacets(axis!),
    enabled: axis !== null,
  });
}
