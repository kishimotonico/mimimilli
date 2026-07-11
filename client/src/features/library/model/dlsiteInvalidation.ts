import { LIBRARY_KEYS } from "./queryKeys";

export function getDlsiteInvalidationKeys(workId?: string) {
  return [
    LIBRARY_KEYS.allWorks(),
    LIBRARY_KEYS.allFacets(),
    LIBRARY_KEYS.tags(),
    LIBRARY_KEYS.allSmartFolderWorks(),
    workId ? LIBRARY_KEYS.workDetail(workId) : (["work"] as const),
  ] as const;
}
