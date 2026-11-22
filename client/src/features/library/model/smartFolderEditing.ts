// スマートフォルダーの編集の純粋な部分（ADR-0040「既定のスマートフォルダー」「条件の編集」）。
// 権限・並べ替え・条件の表示・グループ分けの選択肢・複製と追加の下書きを持つ。

import {
  ALL_SMART_FOLDER_ID,
  EMPTY_CONDITION,
  SMART_FOLDER_TEMPLATES,
  findSmartFolderTemplate,
  rootChildren,
  type Condition,
  type GroupBy,
  type Predicate,
  type SmartFolder,
  type SmartFolderTemplate,
  type SmartFolderWrite,
  type SortId,
  type TagPrefix,
} from "@mimimilli/shared";

export interface SmartFolderPermissions {
  rename: boolean;
  editCondition: boolean;
  editGroupBy: boolean;
  /** 既定の並びを「『すべて』と同じ」（null）にできるか */
  inheritSort: boolean;
  remove: boolean;
  /** 編集のダイアログを開けるか。壊れた行は削除だけ */
  edit: boolean;
}

/** 権限を決めるのはテンプレートの固定 ID だけ。サーバーの assertUpdatable・assertDeletable と同じ規則 */
export function smartFolderPermissions(folder: SmartFolder): SmartFolderPermissions {
  if (folder.condition === null) {
    return {
      rename: false,
      editCondition: false,
      editGroupBy: false,
      inheritSort: false,
      remove: true,
      edit: false,
    };
  }
  const isAll = folder.id === ALL_SMART_FOLDER_ID;
  const isTemplate = findSmartFolderTemplate(folder.id) !== undefined;
  return {
    rename: !isAll,
    editCondition: !isTemplate,
    editGroupBy: !isTemplate,
    inheritSort: !isAll,
    remove: !isAll,
    edit: true,
  };
}

// ── 並べ替え ─────────────────────────────────────────────────

export type ReorderOperation = "reorder-before" | "reorder-after";

/** source を target の前後へ動かした全件の ID 列。動かせないときは null */
export function reorderIds(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
  operation: ReorderOperation,
): string[] | null {
  if (sourceId === targetId || !ids.includes(sourceId) || !ids.includes(targetId)) return null;
  const rest = ids.filter((id) => id !== sourceId);
  const targetIndex = rest.indexOf(targetId);
  const next = [...rest];
  next.splice(operation === "reorder-before" ? targetIndex : targetIndex + 1, 0, sourceId);
  return next.every((id, index) => id === ids[index]) ? null : next;
}

/** 並べ替えの結果をキャッシュの一覧へ先に反映する（位置は添字に振り直す） */
export function applyOrder(folders: readonly SmartFolder[], ids: readonly string[]): SmartFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  return ids.flatMap((id, position) => {
    const folder = byId.get(id);
    return folder ? [{ ...folder, position }] : [];
  });
}

// ── 条件の表示 ───────────────────────────────────────────────

function durationText(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60}分` : `${sec}秒`;
}

const tagLabel = (tag: string) => (tag.includes("/") ? tag : `#${tag}`);

function predicateText(predicate: Predicate, negated: boolean): string {
  switch (predicate.type) {
    case "tag":
      return `${tagLabel(predicate.tag)} を${negated ? "含まない" : "含む"}`;
    case "hasPrefix":
      return `${predicate.prefix}/ のタグが${negated ? "ない" : "ある"}`;
    case "duration": {
      const atLeast = (predicate.op === "gte") !== negated;
      const text = durationText(predicate.sec);
      if (!negated) return `${text}${atLeast ? "以上" : "以下"}`;
      return `${text}${atLeast ? "以上" : "以下"}ではない`;
    }
    case "bookmarked":
      return negated ? "お気に入りでない" : "お気に入り";
    case "played":
      if (predicate.withinDays === undefined) {
        return negated ? "再生したことがない" : "再生したことがある";
      }
      return `${predicate.withinDays}日以内に再生${negated ? "していない" : ""}`;
    case "added":
      return `${predicate.withinDays}日以内に追加${negated ? "していない" : ""}`;
    case "addedYear":
      return `${predicate.year}年に追加${negated ? "していない" : ""}`;
    case "hasError":
      return negated ? "エラーなし" : "エラーあり";
    case "text":
      return `「${predicate.q}」を${negated ? "含まない" : "含む"}`;
  }
}

function isPredicateNode(condition: Condition): condition is Predicate {
  return condition.type !== "and" && condition.type !== "or" && condition.type !== "not";
}

function orText(children: readonly Condition[]): string {
  return children
    .map((child) => (isPredicateNode(child) ? predicateText(child, false) : "…"))
    .join(" または ");
}

/** ルート直下の子1つを人が読める1行にする。まとまり（or・not(or)）はまとまり単位 */
export function conditionRowText(child: Condition): string {
  if (isPredicateNode(child)) return predicateText(child, false);
  if (child.type === "or") return orText(child.children);
  if (child.type === "not") {
    const inner = child.child;
    if (isPredicateNode(inner)) return predicateText(inner, true);
    if (inner.type === "or") {
      return `どれでもない: ${inner.children
        .map((c) => (isPredicateNode(c) ? predicateText(c, false) : "…"))
        .join("、")}`;
    }
  }
  return "…";
}

/** ルート直下の子を1つ外した条件。まとまりはまとまりごと外れる */
export function withoutRootChild(condition: Condition, index: number): Condition {
  return { type: "and", children: rootChildren(condition).filter((_, i) => i !== index) };
}

// ── グループ分け ─────────────────────────────────────────────

export type GroupByKey = string;

export function groupByKey(groupBy: GroupBy | null): GroupByKey {
  if (groupBy === null) return "";
  return groupBy.kind === "prefix" ? `prefix:${groupBy.prefix}` : groupBy.kind;
}

export function groupByFromKey(key: GroupByKey): GroupBy | null {
  if (key === "") return null;
  if (key === "tag") return { kind: "tag" };
  if (key === "addedYear") return { kind: "addedYear" };
  return { kind: "prefix", prefix: key.slice("prefix:".length) };
}

export interface GroupByOption {
  key: GroupByKey;
  label: string;
}

/** 選べるのは、定義済みの prefix 全部・全タグ・追加年。今のグループ分けが定義に無ければ足す */
export function groupByOptions(
  tagPrefixes: readonly TagPrefix[],
  current: GroupBy | null,
): GroupByOption[] {
  const prefixes = tagPrefixes.map((p) => p.prefix);
  if (current?.kind === "prefix" && !prefixes.includes(current.prefix)) {
    prefixes.push(current.prefix);
  }
  return [
    ...prefixes.map((prefix) => ({ key: `prefix:${prefix}`, label: `${prefix}/` })),
    { key: "tag", label: "全タグ" },
    { key: "addedYear", label: "追加年" },
  ];
}

// ── 既定から追加・複製・グループ分けの追加 ─────────────────────

/** 今ない固定 ID のテンプレート（消した既定も含む）。テンプレートの順 */
export function missingTemplates(folders: readonly SmartFolder[]): SmartFolderTemplate[] {
  const present = new Set(folders.map((folder) => folder.id));
  return SMART_FOLDER_TEMPLATES.filter((template) => !present.has(template.id));
}

export interface SmartFolderDraft {
  name: string;
  condition: Condition;
  sort: SortId | null;
  groupBy: GroupBy | null;
}

export function draftOf(folder: SmartFolder & { condition: Condition }): SmartFolderDraft {
  return {
    name: folder.name,
    condition: folder.condition,
    sort: folder.sort,
    groupBy: folder.groupBy,
  };
}

/** 絞り込みの無い複製の下書き。元の定義と既定の並び（継承ならそのまま継承）を写す */
export function duplicateDraft(folder: SmartFolder & { condition: Condition }): SmartFolderDraft {
  return { ...draftOf(folder), name: `${folder.name}（コピー）` };
}

/** 条件なしのグループ分けのスマートフォルダーの下書き */
export function groupDraft(groupBy: GroupBy): SmartFolderDraft {
  return { name: "", condition: EMPTY_CONDITION, sort: null, groupBy };
}

export type SmartFolderDialogTarget =
  | { kind: "edit"; folder: SmartFolder & { condition: Condition } }
  | { kind: "duplicate"; folder: SmartFolder & { condition: Condition } }
  | { kind: "save"; draft: SmartFolderDraft }
  | { kind: "group" };

export function toWrite(draft: SmartFolderDraft): SmartFolderWrite {
  return { ...draft, name: draft.name.trim() };
}
