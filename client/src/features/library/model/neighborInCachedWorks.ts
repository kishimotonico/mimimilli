import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { WorksPage } from "@mimimilli/shared";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import { folderWorksKey } from "./folderWorksRequest";

/**
 * 一覧が描画されない画面（作品詳細ページ）から、戻る先の一覧で指定した作品の次（末尾なら前）の作品 ID。
 * 一覧のクエリのキャッシュから探す。キャッシュが無い・作品が見つからなければ null。
 */
export function neighborInCachedWorks(
  queryClient: QueryClient,
  view: ResolvedLibraryView | null,
  searchQuery: string,
  workId: string,
): string | null {
  if (view?.kind !== "works") return null;
  const data = queryClient.getQueryData<InfiniteData<WorksPage>>(folderWorksKey(view, searchQuery));
  const ids = data?.pages.flatMap((page) => page.items.map((item) => item.id)) ?? [];
  const at = ids.indexOf(workId);
  if (at < 0) return null;
  return ids[at + 1] ?? ids[at - 1] ?? null;
}
