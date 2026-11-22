// スマートフォルダーの既定テンプレートの行への写し（ADR-0040）。
// 編集の権限の規則は shared（smartFolderPermissions・updateViolation など）にあり、HTTP への写しは route が行う。
import type { SmartFolderTemplate } from "@mimimilli/shared";
import type { SmartFolderInsert } from "../adapter/classification.ts";

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
