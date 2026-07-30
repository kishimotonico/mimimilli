import { useDlsiteNotificationList } from "./useDlsiteNotificationList";

export function useDlsiteFetchFailedWorks() {
  return useDlsiteNotificationList("fetch-failed");
}
