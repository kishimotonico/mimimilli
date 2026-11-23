// 起動時に入れるスマートフォルダーの行（ADR-0040「既定のスマートフォルダー」）。real と fixture が同じ関数を通す。
import {
  ALL_SMART_FOLDER_ID,
  definitionOf,
  SMART_FOLDER_TEMPLATES,
  type SmartFolderTemplate,
} from "@mimimilli/shared";
import type { SmartFolderInsert } from "../adapter/smartFolder.ts";

function insertFromTemplate(template: SmartFolderTemplate, createdAt: string): SmartFolderInsert {
  return { ...definitionOf(template), id: template.id, createdAt };
}

/** 「すべて」が無ければ入れる。残りの既定は、まだ入れていないときだけ入れる（全部消しても戻さない）。
 *  今ある ID のものは飛ばす */
export function initialSmartFolders(
  existingIds: ReadonlySet<string>,
  seeded: boolean,
  createdAt: string,
): SmartFolderInsert[] {
  return SMART_FOLDER_TEMPLATES.filter(
    (template) =>
      !existingIds.has(template.id) &&
      (template.id === ALL_SMART_FOLDER_ID || (!seeded && template.seeded)),
  ).map((template) => insertFromTemplate(template, createdAt));
}
