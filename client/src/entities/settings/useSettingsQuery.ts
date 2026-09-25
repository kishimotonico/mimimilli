import { useQuery } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEYS } from "./queryKeys";
import { getSettings } from "./api";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.all(),
    queryFn: getSettings,
    retry: 1,
    // root再設定中(running)は進捗をこのクエリで追う（GET /api/settingsはロック中も許可される）。
    refetchInterval: (query) =>
      query.state.data?.rootReconfiguration?.status === "running" ? 1000 : false,
  });
}

export class RootFolderNotSetError extends Error {
  constructor() {
    super("ルートフォルダーが未設定です。アプリを再起動してください。");
    this.name = "RootFolderNotSetError";
  }
}

/** 通常画面の前提（起動ゲート通過後は rootFolder が必ずある）を型で表す。前提が崩れていれば投げる */
export function requireRootFolder(rootFolder: string | null | undefined): string {
  if (!rootFolder) throw new RootFolderNotSetError();
  return rootFolder;
}

/** 通常画面専用。settings 未取得・rootFolder 未設定なら投げる */
export function useRootFolder(): string {
  return requireRootFolder(useSettingsQuery().data?.rootFolder);
}

/** 起動ゲート（App の startupState 判定・RootConfigurationScreen）専用。root がまだ無い状態を扱う */
export function useRootFolderOrNull(): string | null {
  return useSettingsQuery().data?.rootFolder ?? null;
}
