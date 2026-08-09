// fixture アダプタ: インメモリの seed データを使う DataAdapter 実装。
// 開発・ビジュアルテスト用（ADR-0002）。core/ の pure 関数を使って全メソッドを実装する。
import type { DataAdapter } from "../../adapter/index.ts";
import { createClassificationMethods } from "./classification.ts";
import { createCoverMediaMethods } from "./coverMedia.ts";
import { createDlsiteMethods } from "./dlsiteMethods.ts";
import { createFsMethods } from "./fsMethods.ts";
import { createSettingsScanMethods } from "./settingsScan.ts";
import { createInitialState, type FixtureAdapterOptions } from "./state.ts";
import { createWorkMethods } from "./works.ts";

export type { FixtureAdapterOptions } from "./state.ts";

export function createFixtureAdapter(options: FixtureAdapterOptions = {}): DataAdapter {
  const state = createInitialState(options);
  return {
    ...createSettingsScanMethods(state),
    ...createWorkMethods(state),
    ...createClassificationMethods(state),
    ...createFsMethods(state),
    ...createCoverMediaMethods(state),
    ...createDlsiteMethods(state),
  };
}
