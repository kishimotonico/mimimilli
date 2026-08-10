import {
  evaluateParseErrorAlert,
  isDlsiteFetchFailed,
  isDlsiteParseFailed,
  isDlsiteUnlinked,
  isRjCodeMissing,
  type DlsiteNotificationSummary,
  type DlsiteState,
} from "@mimimilli/shared";

export function summarizeDlsiteNotifications(states: DlsiteState[]): DlsiteNotificationSummary {
  const parseErrorCount = states.filter(isDlsiteParseFailed).length;
  const parseSuccessCount = states.filter((state) => state.status === "applied").length;
  return {
    rjCodeMissingCount: states.filter(isRjCodeMissing).length,
    fetchFailedCount: states.filter(isDlsiteFetchFailed).length,
    parseErrorCount,
    parseErrorAlert: evaluateParseErrorAlert(parseErrorCount, parseSuccessCount),
    unlinkedCount: states.filter(isDlsiteUnlinked).length,
  };
}
