import { isRjCodeMissing, workspacePath } from "@mimimilli/shared";
import type {
  ScanCandidate,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
  ScanResult,
  Settings,
  SettingsUpdate,
} from "@mimimilli/shared";
import type { ScanOptions } from "../../adapter/index.ts";
import type { SettingsAdapter } from "../../adapter/settings.ts";
import type { FixtureState } from "./state.ts";

const FIXTURE_SCAN_STEP_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registrationRjLabel(candidate: ScanCandidate, item: ScanCandidateRegisterItem): string {
  if (item.rjCode === undefined) return `auto:${candidate.rjCode ?? "none"}`;
  if (item.rjCode === "") return "explicit-empty";
  return item.rjCode;
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
      const excluded = new Set(state.scanCandidateExclusions);
      return {
        registered: state.works.length,
        insertedWorkIds: state.scanInsertedWorkIds,
        updatedWorkIds: state.scanUpdatedWorkIds,
        errors: state.works.filter((w) => w.status === "error").length,
        missing: state.works.filter((w) => w.status === "missing").length,
        rjCodeMissingCount: state.works.filter((w) => isRjCodeMissing(w.dlsite)).length,
        skipped: 0,
        coverErrors: 0,
        unreadablePaths: [],
        identityConflicts: state.scanIdentityConflicts,
        invalidMetaFiles: state.scanInvalidMetaFiles,
        candidates: state.scanCandidates.filter((candidate) => !excluded.has(candidate.path)),
      };
    },

    async listScanDiagnostics() {
      return state.identityConflicts;
    },
    async listScanCandidates(): Promise<ScanCandidate[]> {
      const excluded = new Set(state.scanCandidateExclusions);
      return state.scanCandidates.filter((candidate) => !excluded.has(candidate.path));
    },
    async registerScanCandidates(items): Promise<ScanCandidatesRegisterResponse> {
      const candidatesByPath = new Map<string, ScanCandidate>(
        state.scanCandidates.map((candidate) => [candidate.path, candidate]),
      );
      const registered = items.flatMap((item, index) => {
        const candidate = candidatesByPath.get(item.path);
        if (!candidate) return [];
        return [
          {
            path: candidate.path,
            workId: `fixture-candidate-${index}-${registrationRjLabel(candidate, item)}`,
          },
        ];
      });
      const failures = items.flatMap((item) =>
        candidatesByPath.has(item.path)
          ? []
          : [{ path: workspacePath(item.path), message: "候補が見つかりません" }],
      );
      const registeredPaths = new Set(registered.map((candidate) => candidate.path));
      state.scanCandidates = state.scanCandidates.filter(
        (candidate) => !registeredPaths.has(candidate.path),
      );
      return { registered, failures };
    },
    async excludeScanCandidates(paths): Promise<void> {
      // 除外は可逆な扱い（restoreScanCandidateExclusionsで戻せる）なので、
      // state.scanCandidates 自体からは削除しない。一覧側（listScanCandidates/scan）が
      // scanCandidateExclusions を都度フィルタして隠す。
      for (const path of paths) {
        if (!state.scanCandidateExclusions.includes(path)) {
          state.scanCandidateExclusions.push(path);
        }
      }
    },
    async listScanCandidateExclusions(): Promise<string[]> {
      return [...state.scanCandidateExclusions];
    },
    async restoreScanCandidateExclusions(paths): Promise<void> {
      state.scanCandidateExclusions = state.scanCandidateExclusions.filter(
        (path) => !paths.includes(path),
      );
    },
  };
}
