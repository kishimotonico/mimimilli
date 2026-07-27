import { useQuery } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";
import { getSettings } from "./api";

/** 設定（GET /settings）の購読。複数箇所が同じ観測者オプションを使うようここへ集約する。 */
export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.all(),
    queryFn: getSettings,
    retry: 1,
  });
}

/** ルートフォルダーの絶対パス。未設定・取得前は null。 */
export function useRootFolder(): string | null {
  return useSettingsQuery().data?.rootFolder ?? null;
}
