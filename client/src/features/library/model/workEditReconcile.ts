import { tagEquals } from "@mimimilli/shared";
import type { NormalizedTag, UrlEntry, WorkEditSnapshot } from "@mimimilli/shared";

// 作品編集ダイアログの一括draft保存（ADR-0025）が、背景で届いた新しいsnapshot
// （投影の再取り込み、DlsiteEditorの独立適用、409後の再取得のいずれも同じ形で扱う）を
// 基準snapshotへ取り込むかどうかを決める純粋関数。フィールド単位でdirty（未保存の
// 編集がある）かどうかを見て、dirtyなフィールドが外部でも変わっていた場合だけ
// 「衝突」として呼び出し側（WorkEditDialog）へ選び直しを委ねる。

export type WorkEditField = "title" | "tags" | "urls";
export const WORK_EDIT_FIELDS: readonly WorkEditField[] = ["title", "tags", "urls"];

export interface WorkEditDirtyFlags {
  title: boolean;
  tags: boolean;
  urls: boolean;
}

export interface WorkEditReconcileResult {
  /** accepted と incoming で値が異なるフィールド */
  changedFields: WorkEditField[];
  /** changedFields のうち、draft側もdirtyで自動追従できないフィールド */
  conflictFields: WorkEditField[];
}

export function tagsEqual(a: NormalizedTag[], b: NormalizedTag[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((tag) => b.some((other) => tagEquals(tag, other)));
}

export function urlsEqual(a: UrlEntry[], b: UrlEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => entry.label === b[i]?.label && entry.url === b[i]?.url);
}

export function diffWorkEditFields(
  a: Pick<WorkEditSnapshot, "title" | "tags" | "urls">,
  b: Pick<WorkEditSnapshot, "title" | "tags" | "urls">,
): WorkEditField[] {
  const changed: WorkEditField[] = [];
  if (a.title !== b.title) changed.push("title");
  if (!tagsEqual(a.tags, b.tags)) changed.push("tags");
  if (!urlsEqual(a.urls, b.urls)) changed.push("urls");
  return changed;
}

export function reconcileWorkEditSnapshot(
  accepted: Pick<WorkEditSnapshot, "title" | "tags" | "urls">,
  incoming: Pick<WorkEditSnapshot, "title" | "tags" | "urls">,
  dirty: WorkEditDirtyFlags,
): WorkEditReconcileResult {
  const changedFields = diffWorkEditFields(accepted, incoming);
  const conflictFields = changedFields.filter((field) => dirty[field]);
  return { changedFields, conflictFields };
}
