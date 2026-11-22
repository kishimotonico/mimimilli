// URL とスマートフォルダーの定義の突き合わせ（ADR-0041）。画面・クエリ・パンくず・遷移は
// この結果だけを読む。

import {
  ALL_SMART_FOLDER_ID,
  normalizeSearchQuery,
  type Condition,
  type GroupBy,
  type NormalizedTag,
  type SmartFolder,
  type SortId,
} from "@mimimilli/shared";
import type { LibraryRoute } from "../navigation/model/appRoute";

interface ResolvedBase {
  folder: SmartFolder;
  /** 解決済みの並び（今の並び → フォルダーの既定 → 「すべて」の既定） */
  sort: SortId;
  /** 今の並びが解決後の既定から外れているか（「この並びを既定にする」を出すか） */
  sortDeviates: boolean;
}

export type ResolvedLibraryView =
  | (ResolvedBase & {
      kind: "works";
      condition: Condition;
      group: string | null;
      groupBy: GroupBy | null;
      selectedTags: NormalizedTag[];
      q: string;
      /** サーバーに渡す seed。random のときだけ持つ */
      seed: number | undefined;
      breadcrumb: string[];
    })
  | (ResolvedBase & {
      kind: "value-list";
      condition: Condition;
      groupBy: GroupBy;
      breadcrumb: string[];
    })
  | (ResolvedBase & { kind: "broken"; breadcrumb: string[] });

export type ResolvedViewKind = ResolvedLibraryView["kind"];

/** 値一覧か作品一覧か。値を選ぶ前のグループ分けが値一覧 */
export function resolveLibraryView(
  library: LibraryRoute,
  folders: readonly SmartFolder[],
): ResolvedLibraryView {
  const all = folders.find((folder) => folder.id === ALL_SMART_FOLDER_ID);
  if (!all || all.sort === null) {
    throw new Error("「すべて」のスマートフォルダーがありません");
  }
  const folder = folders.find((item) => item.id === library.folderId) ?? all;
  const defaultSort = folder.sort ?? all.sort;
  const base: ResolvedBase = {
    folder,
    sort: library.sort ?? defaultSort,
    sortDeviates: library.sort !== null && library.sort !== defaultSort,
  };

  const { condition } = folder;
  if (condition === null) {
    return { ...base, kind: "broken", breadcrumb: [folder.name] };
  }

  const groupBy = folder.groupBy;
  if (groupBy !== null && library.group === null) {
    return { ...base, kind: "value-list", condition, groupBy, breadcrumb: [folder.name] };
  }

  const group = groupBy === null ? null : library.group;
  return {
    ...base,
    kind: "works",
    condition,
    group,
    groupBy,
    selectedTags: library.selectedTags,
    q: normalizeSearchQuery(library.q),
    seed: base.sort === "random" ? library.seed : undefined,
    breadcrumb: group === null ? [folder.name] : [folder.name, group],
  };
}
