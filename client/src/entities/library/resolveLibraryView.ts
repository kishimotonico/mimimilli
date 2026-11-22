// URL とスマートフォルダーの定義の突き合わせ（ADR-0041）。画面・クエリ・パンくず・遷移は
// この結果だけを読む。

import {
  ALL_SMART_FOLDER_ID,
  type Condition,
  type GroupBy,
  type GroupSortId,
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
      /** グループ分けのある行の解決済みの値の並び。値を選んだあとの兄弟値の一覧が使う */
      groupSort: GroupSortId | null;
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
      /** 解決済みの値の並び（今の並び → フォルダーの既定） */
      groupSort: GroupSortId;
      /** 今の並びが既定から外れているか（「この並びを既定にする」を出すか） */
      groupSortDeviates: boolean;
      breadcrumb: string[];
    })
  /** 開けない。folder: 行が読めない／sort: 「すべて」の並びを継承するが、その並びが読めない */
  | (ResolvedBase & { kind: "broken"; reason: "folder" | "sort"; breadcrumb: string[] });

export type WorksView = Extract<ResolvedLibraryView, { kind: "works" }>;

/** グループ分けを持つ行の、グループ分けと値の並び（今の並び → 行の既定）。グループ分けの無い行・壊れた行は null */
export function folderGrouping(
  folder: SmartFolder,
  currentGroupSort: GroupSortId | null = null,
): { groupBy: GroupBy; groupSort: GroupSortId } | null {
  if (folder.groupBy === null || folder.groupSort === null) return null;
  return { groupBy: folder.groupBy, groupSort: currentGroupSort ?? folder.groupSort };
}

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
  const grouping = folderGrouping(folder, library.groupSort);
  if (grouping !== null && library.group === null) {
    return {
      folder,
      kind: "value-list",
      condition,
      groupBy: grouping.groupBy,
      groupSort: grouping.groupSort,
      groupSortDeviates: library.groupSort !== null && library.groupSort !== folder.groupSort,
      breadcrumb: [folder.name],
    };
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
    groupSort: grouping?.groupSort ?? null,
    selectedTags: library.selectedTags,
    q: library.q,
    sort,
    sortDeviates: library.sort !== null && library.sort !== defaultSort,
    seed: sort === "random" ? library.seed : undefined,
    breadcrumb: group === null ? [folder.name] : [folder.name, group],
  };
}
