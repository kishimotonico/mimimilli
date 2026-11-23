// 今の絞り込みの保存（ADR-0041「並び順メニューと保存の操作」・ADR-0040「条件の編集」）。
// 条件の木は shared の buildEffectiveCondition で組み、サーバーの評価と同じ規則にする。

import {
  ALL_SMART_FOLDER_ID,
  buildEffectiveCondition,
  normalizeSearchQuery,
  parseTag,
  splitSelectedTags,
  type SmartFolder,
  type SmartFolderPatch,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import { hasChipOrSearchRefinement } from "../../../entities/library/refinement";
import type { ResolvedLibraryView, WorksView } from "../../../entities/library/resolveLibraryView";
import { type SmartFolderDialogTarget } from "./smartFolderEditing";

export type SaveOffer = "save" | "overwrite";

/** 上書きの対象にできるスマートフォルダー（条件を変えられる「すべて」以外で、グループ分けを持たない） */
export function isOverwritable(view: WorksView): boolean {
  return view.groupBy === null && view.folder.id !== ALL_SMART_FOLDER_ID;
}

function groupOf(view: ResolvedLibraryView): string | null {
  return view.kind === "works" ? view.group : null;
}

/** グループの値・チップ・検索語のどれかで絞り込んでいる */
export function isRefined(view: ResolvedLibraryView): boolean {
  return groupOf(view) !== null || hasChipOrSearchRefinement(view);
}

/** チップ列の右端に出す保存の操作。無ければ null */
export function saveOffer(view: ResolvedLibraryView): SaveOffer | null {
  if (
    view.kind === "works" &&
    isOverwritable(view) &&
    (view.selectedTags.length > 0 || view.sortDeviates)
  ) {
    return "overwrite";
  }
  return isRefined(view) ? "save" : null;
}

function effectiveCondition(view: ResolvedLibraryView) {
  const { tags, yearValue } = splitSelectedTags(view.selectedTags);
  const group = groupOf(view);
  return buildEffectiveCondition({
    condition: view.condition,
    ...(group !== null && view.groupBy !== null
      ? { group: { by: view.groupBy, value: group } }
      : {}),
    tags: { tags, yearValue },
    q: view.q,
  });
}

function defaultName(view: ResolvedLibraryView): string {
  const group = groupOf(view);
  if (group !== null) return group;
  if (view.selectedTags.length > 0) {
    return view.selectedTags.map((tag) => parseTag(tag).value).join("・");
  }
  const q = normalizeSearchQuery(view.q);
  return q !== "" ? q : `${view.folder.name}（コピー）`;
}

/** 並びを変えていないときに写す元の既定の並び。「すべて」は継承（null）にして、同じ並びで見え続けるようにする */
function savedSortOf(folder: SmartFolder) {
  return folder.id === ALL_SMART_FOLDER_ID ? null : folder.sort;
}

/** 「検索を保存」「別名で保存」の下書き。グループの値を選んでいれば条件に入るのでグループ分けは外し、
 *  選んでいなければ（値一覧で絞り込んだとき）グループ分けと値の並びを保つ。値の並びは、今の並びを
 *  変えていればその並び、変えていなければ元の値の並び。既定の並びは、変えていなければ元の既定の並びを写し
 *  （「すべて」からは継承）、変えていればその並び。
 */
export function saveSearchDraft(view: ResolvedLibraryView): SmartFolderWrite {
  const { folder } = view;
  const keepsGrouping = groupOf(view) === null;
  const groupSortDeviates = view.kind === "value-list" && view.groupSortDeviates;
  return {
    name: defaultName(view),
    condition: effectiveCondition(view),
    sort: view.kind === "works" && view.sortDeviates ? view.sort : savedSortOf(folder),
    groupBy: keepsGrouping ? folder.groupBy : null,
    groupSort: keepsGrouping ? (groupSortDeviates ? view.groupSort : folder.groupSort) : null,
  };
}

/** 「上書き」で更新する項目。条件に今の絞り込みを足し、並びを変えていればそれを既定の並びにする。
 *  名前・グループ分け・値の並びと、変えない既定の並びは送らない */
export function overwriteChange(view: WorksView): SmartFolderPatch {
  return {
    condition: effectiveCondition(view),
    ...(view.sortDeviates ? { sort: view.sort } : {}),
  };
}

/** 「元に戻す」で戻す項目。上書きが更新した項目だけを上書き前の値にする */
export function overwriteUndoChange(view: WorksView): SmartFolderPatch {
  const { folder } = view;
  return {
    condition: folder.condition,
    ...(view.sortDeviates ? { sort: folder.sort } : {}),
  };
}

export function saveDialogTarget(view: ResolvedLibraryView): SmartFolderDialogTarget {
  return { kind: "save", draft: saveSearchDraft(view) };
}
