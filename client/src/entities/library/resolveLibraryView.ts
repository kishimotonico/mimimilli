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
}

export type ResolvedLibraryView =
  | (ResolvedBase & {
      kind: "works";
      condition: Condition;
      group: string | null;
      groupBy: GroupBy | null;
      selectedTags: NormalizedTag[];
      q: string;
      /** 解決済みの並び（今の並び → フォルダーの既定 → 「すべて」の既定） */
      sort: SortId;
      /** 今の並びが解決後の既定から外れているか（「この並びを既定にする」を出すか） */
      sortDeviates: boolean;
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
  /** 開けない。folder: 行が読めない／sort: 「すべて」の並びを継承するが、その並びが読めない */
  | (ResolvedBase & { kind: "broken"; reason: "folder" | "sort"; breadcrumb: string[] });

export type ResolvedViewKind = ResolvedLibraryView["kind"];

/** 値一覧か作品一覧か。値を選ぶ前のグループ分けが値一覧。選んだ行に要る値だけを確かめる */
export function resolveLibraryView(
  library: LibraryRoute,
  folders: readonly SmartFolder[],
): ResolvedLibraryView {
  const all = folders.find((item) => item.id === ALL_SMART_FOLDER_ID);
  const folder = folders.find((item) => item.id === library.folderId) ?? all;
  if (!folder) throw new Error("「すべて」のスマートフォルダーがありません");

  const { condition } = folder;
  if (condition === null) {
    return { folder, kind: "broken", reason: "folder", breadcrumb: [folder.name] };
  }

  const groupBy = folder.groupBy;
  if (groupBy !== null && library.group === null) {
    return { folder, kind: "value-list", condition, groupBy, breadcrumb: [folder.name] };
  }

  const defaultSort = folder.sort ?? all?.sort ?? null;
  const sort = library.sort ?? defaultSort;
  if (sort === null) {
    return { folder, kind: "broken", reason: "sort", breadcrumb: [folder.name] };
  }

  const group = groupBy === null ? null : library.group;
  return {
    folder,
    kind: "works",
    condition,
    group,
    groupBy,
    selectedTags: library.selectedTags,
    q: normalizeSearchQuery(library.q),
    sort,
    sortDeviates: library.sort !== null && library.sort !== defaultSort,
    seed: sort === "random" ? library.seed : undefined,
    breadcrumb: group === null ? [folder.name] : [folder.name, group],
  };
}
