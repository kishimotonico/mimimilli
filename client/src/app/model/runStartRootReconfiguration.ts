// root再設定の開始・再試行を単一の手順にまとめる（ADR-0029）。
// SetupScreen（初回）・SettingsModal（変更）・RootReconfigurationScreen（再試行）はこの手順を共有する。
import type { RootReconfigurationState } from "@mimimilli/shared";

export interface RunStartRootReconfigurationDeps {
  /** POST /api/root-reconfiguration。400/409はrejectする */
  startRootReconfiguration: (path: string) => Promise<RootReconfigurationState>;
  /** 202成功後にのみ呼ぶ。検証失敗（400）では再生を止めない */
  stopPlayback: () => void;
  /** 202成功後にのみ呼ぶ。Libraryの選択・検索・タグ・軸・候補、作品系クエリを破棄する */
  resetLibraryForReconfiguration: () => void;
  /** 202成功後にのみ呼ぶ。GET /api/settingsを再取得して画面をreconfiguringへ切り替える */
  invalidateSettings: () => Promise<unknown>;
}

export async function runStartRootReconfiguration(
  path: string,
  deps: RunStartRootReconfigurationDeps,
): Promise<RootReconfigurationState> {
  const state = await deps.startRootReconfiguration(path);
  deps.stopPlayback();
  deps.resetLibraryForReconfiguration();
  await deps.invalidateSettings();
  return state;
}
