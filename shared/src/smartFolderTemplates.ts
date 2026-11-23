// スマートフォルダーの既定テンプレートと、テンプレート由来の編集権限（ADR-0040）。
import type { Condition } from "./condition.ts";
import { defaultGroupSort, type GroupBy } from "./groupFilter.ts";
import type { GroupSortId, SortId } from "./library.ts";
import { ALL_SMART_FOLDER_ID, ALL_SMART_FOLDER_NAME, type SmartFolder } from "./smartFolder.ts";

export interface SmartFolderTemplate {
  id: string;
  name: string;
  condition: Condition;
  /** null は「『すべて』と同じ」 */
  sort: SortId | null;
  groupBy: GroupBy | null;
  /** グループ分けがあるテンプレートだけ持つ */
  groupSort: GroupSortId | null;
  /** 初回起動時に投入する */
  seeded: boolean;
}

const and = (...children: Condition[]): Condition => ({
  type: "and",
  children,
});
const grouped = (
  id: string,
  name: string,
  groupBy: GroupBy,
  options: { seeded?: boolean; sort?: SortId } = {},
): SmartFolderTemplate => ({
  id,
  name,
  condition: and(),
  sort: options.sort ?? null,
  groupBy,
  groupSort: defaultGroupSort(groupBy),
  seeded: options.seeded ?? true,
});

export const SMART_FOLDER_TEMPLATES: readonly SmartFolderTemplate[] = [
  {
    id: ALL_SMART_FOLDER_ID,
    name: ALL_SMART_FOLDER_NAME,
    condition: and(),
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "random",
    name: "ランダム",
    condition: and(),
    sort: "random",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "recent",
    name: "最近再生",
    condition: and({ type: "played" }),
    sort: "last-played",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "added",
    name: "最近追加",
    condition: and({ type: "added", withinDays: 30 }),
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "fav",
    name: "お気に入り",
    condition: and({ type: "bookmarked" }),
    sort: null,
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "error",
    name: "エラー",
    condition: and({ type: "hasError" }),
    sort: null,
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  grouped("by-cv", "CV別", { kind: "prefix", prefix: "cv" }),
  grouped("by-circle", "サークル別", { kind: "prefix", prefix: "サークル" }),
  grouped("by-category", "カテゴリ別", { kind: "prefix", prefix: "カテゴリ" }),
  grouped("by-tag", "タグ別", { kind: "tag" }),
  grouped("by-year", "追加年別", { kind: "addedYear" }),
  grouped(
    "by-series",
    "シリーズ別",
    { kind: "prefix", prefix: "シリーズ" },
    { seeded: false, sort: "title-asc" },
  ),
  grouped("by-rating", "レーティング別", { kind: "prefix", prefix: "rating" }, { seeded: false }),
];

export function findSmartFolderTemplate(id: string): SmartFolderTemplate | undefined {
  return SMART_FOLDER_TEMPLATES.find((template) => template.id === id);
}

// ── 編集の権限 ───────────────────────────────────────────────

/** client の UI の出し分け。サーバーが守るのは smartFolderViolation の不変条件だけで、権限では弾かない */
export interface SmartFolderPermissions {
  rename: boolean;
  editCondition: boolean;
  editGroupBy: boolean;
  /** 既定の並びを「『すべて』と同じ」（null）にできるか */
  inheritSort: boolean;
  remove: boolean;
}

export function smartFolderPermissions(folder: Pick<SmartFolder, "id">): SmartFolderPermissions {
  const isAll = folder.id === ALL_SMART_FOLDER_ID;
  const isTemplate = findSmartFolderTemplate(folder.id) !== undefined;
  return {
    rename: !isAll,
    editCondition: !isTemplate,
    editGroupBy: !isTemplate,
    inheritSort: !isAll,
    remove: !isAll,
  };
}
