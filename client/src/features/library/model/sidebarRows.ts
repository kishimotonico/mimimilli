import {
  isHasErrorOnly,
  showsCount,
  type SmartFolder,
  type SmartFolderCounts,
} from "@mimimilli/shared";
import { getSmartFolderIcon } from "../../../entities/library/smartFolderDefinitions";
import type { IconName } from "../../../shared/ui/Icon";

export interface SidebarRow {
  id: string;
  name: string;
  icon: IconName;
  /** 件数を出さない行は null。条件が hasError だけの行は0件も出さない */
  count: number | null;
  /** 条件が hasError だけの行は件数を赤い丸で出す */
  countTone: "plain" | "error";
  hasQuickOverlay: boolean;
}

function toRow(folder: SmartFolder, counts: SmartFolderCounts | undefined): SidebarRow {
  const { condition } = folder;
  const isError = isHasErrorOnly(condition);
  const count = showsCount(folder) ? (counts?.[folder.id] ?? null) : null;
  return {
    id: folder.id,
    name: folder.name,
    icon: getSmartFolderIcon(folder),
    count: isError && count === 0 ? null : count,
    countTone: isError ? "error" : "plain",
    hasQuickOverlay: folder.groupBy !== null,
  };
}

export function buildSidebarRows(
  folders: SmartFolder[],
  counts: SmartFolderCounts | undefined,
): SidebarRow[] {
  return folders.map((folder) => toRow(folder, counts));
}
