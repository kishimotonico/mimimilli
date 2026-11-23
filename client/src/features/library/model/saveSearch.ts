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
} from "@mimimilli/shared";
import { hasChipOrSearchRefinement } from "../../../entities/library/refinement";
import type { ResolvedLibraryView, WorksView } from "../../../entities/library/resolveLibraryView";
import { type SmartFolderDialogTarget, type SmartFolderDraft } from "./smartFolderEditing";

export type SaveOffer = "save" | "overwrite";

/** 上書きの対象にできるスマートフォルダー（条件を変えられる「すべて」以外で、グループ分けを持たない） */
export function isOverwritable(view: WorksView): boolean {
  return view.groupBy === null && view.folder.id !== ALL_SMART_FOLDER_ID;
}

/** グループの値・チップ・検索語のどれかで絞り込んでいる */
export function isRefined(view: WorksView): boolean {
  return view.group !== null || hasChipOrSearchRefinement(view);
}

/** チップ列の右端に出す保存の操作。無ければ null */
export function saveOffer(view: ResolvedLibraryView): SaveOffer | null {
  if (view.kind !== "works") return null;
  if (isOverwritable(view) && (view.selectedTags.length > 0 || view.sortDeviates)) {
    return "overwrite";
  }
  return isRefined(view) ? "save" : null;
}

function effectiveCondition(view: WorksView) {
  const { tags, yearValue } = splitSelectedTags(view.selectedTags);
  return buildEffectiveCondition({
    condition: view.condition,
    ...(view.group !== null && view.groupBy !== null
      ? { group: { by: view.groupBy, value: view.group } }
      : {}),
    tags: { tags, yearValue },
    q: view.q,
  });
}

function defaultName(view: WorksView): string {
  if (view.group !== null) return view.group;
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

/** 「検索を保存」「別名で保存」の下書き。作品一覧ではグループ分けの値は必ず選ばれているので、グループ分けは外す。
 *  既定の並びは、並びを変えていなければ元の既定の並びを写し（「すべて」からは継承）、変えていればその並び。
 */
export function saveSearchDraft(view: WorksView): SmartFolderDraft {
  return {
    name: defaultName(view),
    condition: effectiveCondition(view),
    sort: view.sortDeviates ? view.sort : savedSortOf(view.folder),
    groupBy: null,
    groupSort: null,
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

export function saveDialogTarget(view: WorksView): SmartFolderDialogTarget {
  return { kind: "save", draft: saveSearchDraft(view) };
}
