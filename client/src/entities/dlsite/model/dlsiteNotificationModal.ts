export type DlsiteNotificationModalKind = "rj-missing" | "fetch-failed" | "parse-failed";

export function isDlsiteNotificationModal(
  modal: string | null,
): modal is DlsiteNotificationModalKind {
  return modal === "rj-missing" || modal === "fetch-failed" || modal === "parse-failed";
}
