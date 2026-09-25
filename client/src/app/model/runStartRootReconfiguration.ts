// root再設定の開始・再試行を単一の手順にまとめる（ADR-0029）。
// RootConfigurationScreen（初回・再試行）・SettingsModal（変更）はこの手順を共有する。
import type { RootReconfigurationState } from "@mimimilli/shared";

export interface RunStartRootReconfigurationDeps {
  /** POST /api/root-reconfiguration。400/409はrejectする */
  startRootReconfiguration: (path: string) => Promise<RootReconfigurationState>;
  /** 開始APIを呼ぶ前に完了させる（awaitで直列、並列にしない）。ロック確立後は
   *  resumeの保存が409になり黙って失われるため、ロック前に最終位置を確定させる */
  persistFinalResume: () => Promise<void>;
  /** 202成功後にのみ呼ぶ。検証失敗（400）では再生を止めない。再生停止・nav/URL/
   *  モーダル等のリセット・作品系クエリの破棄をまとめて行う。runningの描画を実際に
   *  観測できたかに依存せず必ず実行する（App.performReconfigurationEntryResetと共有） */
  performEntryReset: () => Promise<void>;
  /** 202成功後にのみ呼ぶ。settingsキャッシュのrootReconfigurationを202応答で即時反映する。
   *  performEntryResetのクエリ破棄より先に呼び、reconfiguring画面への切り替えレンダーの
   *  猶予を作る */
  applyRootReconfigurationState: (state: RootReconfigurationState) => void;
  /** 202成功後にのみ呼ぶ。GET /api/settingsを再取得し、実際の状態と同期する */
  invalidateSettings: () => Promise<unknown>;
}

export async function runStartRootReconfiguration(
  path: string,
  deps: RunStartRootReconfigurationDeps,
): Promise<RootReconfigurationState> {
  await deps.persistFinalResume();
  const state = await deps.startRootReconfiguration(path);
  deps.applyRootReconfigurationState(state);
  await deps.performEntryReset();
  await deps.invalidateSettings();
  return state;
}
