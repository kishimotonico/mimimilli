import type { InvalidateQueryFilters, QueryClient } from "@tanstack/react-query";

/** invalidateQueries の代わりに使う。初回取得中（data なし）の取得は、そのまま invalidate すると
 *  進行中の取得に合流して変更前の応答が残るので、先に取り消して変更後の値で取り直す */
export async function invalidateFresh(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
): Promise<void> {
  await queryClient.cancelQueries({
    ...filters,
    predicate: (query) =>
      query.state.data === undefined &&
      query.state.fetchStatus === "fetching" &&
      (filters.predicate?.(query) ?? true),
  });
  await queryClient.invalidateQueries(filters);
}
