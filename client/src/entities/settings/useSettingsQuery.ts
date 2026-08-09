import { useQuery } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEYS } from "./queryKeys";
import { getSettings } from "./api";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.all(),
    queryFn: getSettings,
    retry: 1,
  });
}

export function useRootFolder(): string | null {
  return useSettingsQuery().data?.rootFolder ?? null;
}
