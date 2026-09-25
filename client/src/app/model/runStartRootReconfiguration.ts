// root再設定の開始・再試行を単一の手順にまとめる（ADR-0029）。
// RootConfigurationScreen（初回・再試行）・SettingsModal（変更）はこの手順を共有する。
import type { RootReconfigurationState } from "@mimimilli/shared";

export interface RunStartRootReconfigurationDeps {
  /** POST /api/root-reconfiguration。400/409はrejectする */
  startRootReconfiguration: (path: string) => Promise<RootReconfigurationState>;
  /** 202成功後にのみ呼ぶ。検証失敗（400）では再生を止めない */
  stopPlayback: () => void;
  /** 202成功後にのみ呼ぶ。Libraryの選択・検索・タグ・軸・候補、作品系クエリをstale化する
   *  （まだ通常UIがアンマウントされる前なので、removeではなく即時フェッチを起こさない形にする） */
  resetLibraryForReconfiguration: () => void;
  /** 202成功後にのみ呼ぶ。settingsキャッシュのrootReconfigurationを202応答で即時反映する。
   *  再取得（invalidateSettings）が先に完了しidleを返す競合（フィクスチャの高速完了等）があっても、
   *  この呼び出しだけで確実にreconfiguring画面へ一度切り替わり、通常UIのアンマウントとそれに続く
   *  作品系クエリの破棄（App側のreconfiguring突入検知）が必ず起きるようにする */
  applyRootReconfigurationState: (state: RootReconfigurationState) => void;
  /** 202成功後にのみ呼ぶ。GET /api/settingsを再取得し、実際の状態と同期する */
  invalidateSettings: () => Promise<unknown>;
}

export async function runStartRootReconfiguration(
  path: string,
  deps: RunStartRootReconfigurationDeps,
): Promise<RootReconfigurationState> {
  const state = await deps.startRootReconfiguration(path);
  deps.stopPlayback();
  deps.resetLibraryForReconfiguration();
  deps.applyRootReconfigurationState(state);
  await deps.invalidateSettings();
  return state;
}
