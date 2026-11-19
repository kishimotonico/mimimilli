import type { ScanCandidateFolder } from "@mimimilli/shared";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { createClassificationMethods } from "../../src/adapters/fixture/classification.ts";
import { createCoverMediaMethods } from "../../src/adapters/fixture/coverMedia.ts";
import { createDlsiteMethods } from "../../src/adapters/fixture/dlsiteMethods.ts";
import { createFsMethods } from "../../src/adapters/fixture/fsMethods.ts";
import { createInitialState } from "../../src/adapters/fixture/state.ts";
import { createSettingsScanMethods } from "../../src/adapters/fixture/settingsScan.ts";
import { createWorkMethods } from "../../src/adapters/fixture/works.ts";

/** 指定した候補フォルダーだけを持つ、作品ゼロのfixtureアダプタ */
export function buildFixtureAdapterWithCandidates(candidates: ScanCandidateFolder[]): DataAdapter {
  const state = createInitialState({ scenario: "empty" });
  state.rootFolder = "/library";
  state.scanCandidates = candidates;
  return {
    ...createSettingsScanMethods(state),
    ...createWorkMethods(state),
    ...createClassificationMethods(state),
    ...createFsMethods(state),
    ...createCoverMediaMethods(state),
    ...createDlsiteMethods(state),
  };
}
