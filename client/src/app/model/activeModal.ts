export type ActiveModal =
  | null
  | "settings"
  | "scan"
  | "rj-missing"
  | "fetch-failed"
  | "parse-failed";

export type DlsiteNotificationModalKind = Extract<
  ActiveModal,
  "rj-missing" | "fetch-failed" | "parse-failed"
>;

export function isDlsiteNotificationModal(
  modal: ActiveModal,
): modal is DlsiteNotificationModalKind {
  return modal === "rj-missing" || modal === "fetch-failed" || modal === "parse-failed";
}
