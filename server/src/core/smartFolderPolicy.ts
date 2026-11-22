// スマートフォルダーの編集権限と既定テンプレートの扱い（ADR-0040）。
// 権限を決めるのはテンプレートの固定 ID だけで、条件の意味では決めない。
import {
  ALL_SMART_FOLDER_ID,
  conditionKey,
  findSmartFolderTemplate,
  type SmartFolderRestore,
  type SmartFolderTemplate,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import type { SmartFolderInsert, SmartFolderRow } from "../adapter/classification.ts";
import { apiError, invalidRequest } from "../lib/httpError.ts";

export function insertFromTemplate(
  template: SmartFolderTemplate,
  createdAt: string,
): SmartFolderInsert {
  return {
    id: template.id,
    name: template.name,
    condition: template.condition,
    sort: template.sort,
    groupBy: template.groupBy,
    createdAt,
  };
}

function forbidden(message: string): never {
  throw apiError("forbidden", message);
}

function sameDefinition(
  template: SmartFolderTemplate,
  folder: {
    condition: SmartFolderWrite["condition"] | null;
    groupBy: SmartFolderWrite["groupBy"] | null;
  },
): boolean {
  return (
    folder.condition !== null &&
    conditionKey(folder.condition) === conditionKey(template.condition) &&
    JSON.stringify(folder.groupBy) === JSON.stringify(template.groupBy)
  );
}

/** 既定のものは名前・既定の並びだけ変えられる。「すべて」は名前も変えられず、並びを null にもできない */
export function assertUpdatable(existing: SmartFolderRow, write: SmartFolderWrite): void {
  const template = findSmartFolderTemplate(existing.id);
  if (!template) return;
  if (!sameDefinition(template, write)) {
    forbidden("既定のスマートフォルダーの条件・グループ分けは変更できません");
  }
  if (existing.id === ALL_SMART_FOLDER_ID) {
    if (write.name !== existing.name) forbidden("「すべて」の名前は変更できません");
    if (write.sort === null) invalidRequest("「すべて」の既定の並びは空にできません");
  }
}

export function assertDeletable(existing: SmartFolderRow): void {
  if (existing.id === ALL_SMART_FOLDER_ID) forbidden("「すべて」は削除できません");
}

/** テンプレートの固定 ID の行は、条件・グループ分けがテンプレートと一致するときだけ戻せる */
export function assertRestorable(restore: SmartFolderRestore): void {
  const template = findSmartFolderTemplate(restore.id);
  if (template && !sameDefinition(template, restore)) {
    invalidRequest(
      "既定のスマートフォルダーは、条件・グループ分けがテンプレートと同じものだけ戻せます",
    );
  }
}
