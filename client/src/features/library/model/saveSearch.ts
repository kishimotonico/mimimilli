// 今の絞り込みの保存（ADR-0041「並び順メニューと保存の操作」・ADR-0040「条件の編集」）。
// 条件の木は shared の buildEffectiveCondition で組み、サーバーの評価と同じ規則にする。

import {
  ALL_SMART_FOLDER_ID,
  buildEffectiveCondition,
  normalizeSearchQuery,
  parseTag,
  isReadableSmartFolder,
  smartFolderPermissions,
  splitSelectedTags,
  type ReadableSmartFolder,
  type SmartFolder,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import { hasChipOrSearchRefinement } from "../../../entities/library/refinement";
import type { ResolvedLibraryView, WorksView } from "../../../entities/library/resolveLibraryView";
import { type SmartFolderDialogTarget, type SmartFolderDraft } from "./smartFolderEditing";

export type SaveOffer = "save" | "overwrite";

/** 上書きの対象にできる自作のスマートフォルダー（条件を変えられ、グループ分けを持たない） */
export type OverwritableView = WorksView & { folder: ReadableSmartFolder };

export function isOverwritable(view: WorksView): view is OverwritableView {
  return (
    isReadableSmartFolder(view.folder) &&
    view.groupBy === null &&
    smartFolderPermissions(view.folder).editCondition
  );
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

/** 「上書き」の中身。条件に今の絞り込みを足し、並びを変えていればそれを既定の並びにする */
export function overwriteWrite(view: OverwritableView): SmartFolderWrite {
  const { folder } = view;
  return {
    name: folder.name,
    condition: effectiveCondition(view),
    sort: view.sortDeviates ? view.sort : folder.sort,
    groupBy: folder.groupBy,
    groupSort: folder.groupSort,
  };
}

export function saveDialogTarget(view: WorksView): SmartFolderDialogTarget {
  return { kind: "save", draft: saveSearchDraft(view) };
}
