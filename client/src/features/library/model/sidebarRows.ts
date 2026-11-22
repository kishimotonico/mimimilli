import { isHasErrorOnly, isHiddenWhenEmpty, showsCount, type SmartFolder } from "@mimimilli/shared";
import { getSmartFolderIcon } from "../../../entities/library/axisDefinitions";
import type { IconName } from "../../../shared/ui/Icon";

/** 診断上のデータ不整合の件数（ADR-0039）。取得中・取得失敗は unknown で、0件とは扱わない */
export type DataIntegrityCount = { status: "ready"; count: number } | { status: "unknown" };

export interface SidebarRow {
  id: string;
  name: string;
  icon: IconName;
  /** 件数を出さない行は null */
  count: number | null;
  /** 条件が hasError だけの行は件数を赤い丸で出す */
  countTone: "plain" | "error";
  hasQuickOverlay: boolean;
  /** 通常は隠れる行（編集の状態でだけ見える） */
  dimmed: boolean;
}

/** 0件で隠す行か。作品数とデータ不整合の両方が0と分かったときだけ隠し、開いている行は残す */
function isHidden(
  folder: SmartFolder,
  activeFolderId: string,
  integrity: DataIntegrityCount,
): boolean {
  const { condition } = folder;
  if (condition === null || !isHiddenWhenEmpty(condition)) return false;
  if (folder.id === activeFolderId) return false;
  return folder.count === 0 && integrity.status === "ready" && integrity.count === 0;
}

function toRow(folder: SmartFolder): SidebarRow {
  const { condition } = folder;
  if (condition === null) {
    return {
      id: folder.id,
      name: folder.name,
      icon: "err",
      count: null,
      countTone: "plain",
      hasQuickOverlay: false,
      dimmed: false,
    };
  }
  return {
    id: folder.id,
    name: folder.name,
    icon: getSmartFolderIcon(folder.id),
    count: showsCount({ condition, groupBy: folder.groupBy }) ? folder.count : null,
    countTone: isHasErrorOnly(condition) ? "error" : "plain",
    hasQuickOverlay: folder.groupBy !== null,
    dimmed: false,
  };
}

/** 編集の状態（editing）では、0件で隠れる行も見せる */
export function buildSidebarRows(
  folders: SmartFolder[],
  activeFolderId: string,
  integrity: DataIntegrityCount,
  editing = false,
): SidebarRow[] {
  return folders.flatMap((folder) => {
    const hidden = isHidden(folder, activeFolderId, integrity);
    if (hidden && !editing) return [];
    return [{ ...toRow(folder), dimmed: hidden }];
  });
}
