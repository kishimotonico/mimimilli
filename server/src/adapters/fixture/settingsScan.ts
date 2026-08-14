import { emptyDlsiteState, isRjCodeMissing, workspacePath } from "@mimimilli/shared";
import type {
  ScanCandidate,
  ScanCandidatesRegisterResponse,
  ScanResult,
  Settings,
  SettingsUpdate,
  WorkSummary,
} from "@mimimilli/shared";
import type { ScanOptions } from "../../adapter/index.ts";
import type { SettingsAdapter } from "../../adapter/settings.ts";
import { normalizeFsPath } from "./fsResolve.ts";
import type { FixtureState } from "./state.ts";

const FIXTURE_SCAN_STEP_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 候補承認時のRJコード解決（候補登録APIの規約と同じ）。
 *  rjCode省略=候補が検出した値を採用 / ""=明示的になし / 値=そのまま採用。 */
export function resolveRegisteredRjCode(
  candidateRjCode: string | null,
  itemRjCode: string | undefined,
): string | null {
  if (itemRjCode === undefined) return candidateRjCode;
  return itemRjCode === "" ? null : itemRjCode;
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
        candidatePool: state.scanCandidates,
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
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const now = new Date().toISOString();
      // real adapter の registerCandidates（scanner.ts）と同じ意味論: 登録した候補は
      // 実際にcatalog（ここではstate.works）へ行が増える。作品一覧・スキャン結果一覧の
      // 両方から見えて初めて「登録した」と言える。
      const registered = items.flatMap((item) => {
        const candidate = candidatesByPath.get(item.path);
        if (!candidate) return [];
        const rjCode = resolveRegisteredRjCode(candidate.rjCode, item.rjCode);
        const work: WorkSummary = {
          id: crypto.randomUUID(),
          title: candidate.inferredTitle,
          cover: null,
          status: "ok",
          physicalPath: normalizeFsPath(`${rootAbs}/${candidate.path}`),
          totalDurationSec: 0,
          trackCount: candidate.audioFileCount,
          addedAt: now,
          errorMessage: null,
          urls: [],
          tags: [],
          bookmarked: false,
          lastPlayedAt: null,
          dlsite: rjCode ? { ...emptyDlsiteState(), rjCode } : emptyDlsiteState(),
        };
        state.works.push(work);
        return [{ path: candidate.path, workId: work.id }];
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
