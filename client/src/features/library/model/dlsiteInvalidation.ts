import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

export function getDlsiteInvalidationKeys(workId?: string) {
  return [
    WORK_QUERY_KEYS.all(),
    WORK_QUERY_KEYS.dlsiteNotifications(),
    WORK_QUERY_KEYS.allFacets(),
    TAG_QUERY_KEYS.all(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
    workId ? WORK_QUERY_KEYS.detail(workId) : WORK_QUERY_KEYS.allDetails(),
  ] as const;
}
