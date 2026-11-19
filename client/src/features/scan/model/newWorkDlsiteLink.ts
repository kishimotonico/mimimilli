import type { WorkListItemDlsite } from "@mimimilli/shared";
import { hasRjCode } from "@mimimilli/shared";

export type NewWorkDlsiteLink = "linked" | "unlinked";

/** 新規作品のDLsite列の表示区分。RJコードが無い作品は null（空欄） */
export function newWorkDlsiteLink(dlsite: WorkListItemDlsite): NewWorkDlsiteLink | null {
  if (!hasRjCode(dlsite)) return null;
  return dlsite.status === "applied" ? "linked" : "unlinked";
}
