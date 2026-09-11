import type { DlsiteNotificationModalKind } from "../../../shared/model/activeModalAtom";

export type { DlsiteNotificationModalKind };

export function isDlsiteNotificationModal(
  modal: string | null,
): modal is DlsiteNotificationModalKind {
  return modal === "rj-missing" || modal === "fetch-failed" || modal === "parse-failed";
}
