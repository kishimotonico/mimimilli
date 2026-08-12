import { isRjCodeMissing } from "@mimimilli/shared";
import type { ScanResult, Settings, SettingsUpdate } from "@mimimilli/shared";
import type { ScanOptions } from "../../adapter/index.ts";
import type { SettingsAdapter } from "../../adapter/settings.ts";
import type { FixtureState } from "./state.ts";

const FIXTURE_SCAN_STEP_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSettingsScanMethods(state: FixtureState): SettingsAdapter {
  return {
    async getSettings(): Promise<Settings> {
      return { rootFolder: state.rootFolder, lastScanTime: state.lastScanTime };
    },

    async updateSettings(patch: SettingsUpdate): Promise<Settings> {
      state.rootFolder = patch.rootFolder;
      return { rootFolder: state.rootFolder, lastScanTime: state.lastScanTime };
    },

    async scan(options?: ScanOptions): Promise<ScanResult> {
      const emit = options?.onProgress ?? ((): void => {});
      const checkAbort = () => {
        if (options?.signal?.aborted)
          throw new DOMException("スキャンはキャンセルされました", "AbortError");
      };
      const pseudoSteps = 4;

      checkAbort();
      emit({ type: "progress", phase: "walking", processed: 0, total: 0 });
      await sleep(FIXTURE_SCAN_STEP_MS);
      checkAbort();
      emit({ type: "progress", phase: "registering", processed: 0, total: pseudoSteps });
      for (let i = 1; i <= pseudoSteps; i++) {
        await sleep(FIXTURE_SCAN_STEP_MS);
        checkAbort();
        emit({ type: "progress", phase: "registering", processed: i, total: pseudoSteps });
      }
      await sleep(FIXTURE_SCAN_STEP_MS);
      checkAbort();
      emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });

      state.lastScanTime = new Date().toISOString();
      return {
        registered: state.works.length,
        newlyGenerated: state.scanNewWorkIds.length,
        errors: state.works.filter((w) => w.status === "error").length,
        missing: state.works.filter((w) => w.status === "missing").length,
        newWorkIds: state.scanNewWorkIds,
        rjCodeMissingCount: state.works.filter((w) => isRjCodeMissing(w.dlsite)).length,
        skipped: 0,
        coverErrors: 0,
        unreadablePaths: [],
        identityConflicts: state.identityConflicts,
      };
    },

    async listScanDiagnostics() {
      return state.identityConflicts;
    },
  };
}
