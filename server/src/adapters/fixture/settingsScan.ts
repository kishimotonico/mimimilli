import { isRjCodeMissing, workspacePath } from "@mimimilli/shared";
import type { ScanCandidate, ScanCandidatesRegisterResponse, ScanResult } from "@mimimilli/shared";
import type {
  RootReconfigurationAdapter,
  RootReconfigurationRecord,
  ScanOptions,
  SettingsAdapter,
  StoredSettings,
} from "../../adapter/index.ts";
import type { FixtureWorkRecord } from "./data.ts";
import { isFsPathWithin, normalizeFsPath } from "./fsResolve.ts";
import { FIXTURE_UNREADABLE_ROOT } from "./scenarios.ts";
import { dlsiteLinkageOf, setDlsiteLinkage, type FixtureState } from "./state.ts";

const FIXTURE_SCAN_STEP_MS = 20;
const FIXTURE_ROOT_REBUILD_STEP_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 候補承認時のRJコード解決（候補登録APIの規約と同じ）。
 *  rjCode省略=候補が検出した値を採用 / ""=明示的になし / 値=そのまま採用。 */
export function resolveRegisteredRjCode(
  candidateRjCode: string | null,
  itemRjCode: string | undefined,
): string | null {
  return itemRjCode === undefined ? candidateRjCode : itemRjCode;
}

async function runPseudoScan(
  state: FixtureState,
  options: ScanOptions,
  stepMs: number,
): Promise<ScanResult> {
  const emit = options.onProgress ?? ((): void => {});
  const checkAbort = () => {
    if (options.signal?.aborted)
      throw new DOMException("スキャンはキャンセルされました", "AbortError");
  };
  const pseudoSteps = 4;

  checkAbort();
  emit({ type: "progress", phase: "walking", processed: 0, total: 0 });
  await sleep(stepMs);
  checkAbort();
  emit({ type: "progress", phase: "registering", processed: 0, total: pseudoSteps });
  for (let i = 1; i <= pseudoSteps; i++) {
    await sleep(stepMs);
    checkAbort();
    emit({ type: "progress", phase: "registering", processed: i, total: pseudoSteps });
  }
  await sleep(stepMs);
  checkAbort();
  emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });

  state.lastScanTime = new Date().toISOString();
  state.scanCandidates = [...state.scanCandidatePool];
  const excluded = new Set(state.scanCandidateExclusions);
  return {
    registered: state.works.length,
    insertedWorkIds: state.scanInsertedWorkIds,
    updatedWorkIds: state.scanUpdatedWorkIds,
    errors: state.works.filter((w) => w.status === "error").length,
    missing: state.works.filter((w) => w.status === "missing").length,
    rjCodeMissingCount: state.works.filter((w) => isRjCodeMissing(dlsiteLinkageOf(state, w.id)))
      .length,
    skipped: 0,
    coverErrors: 0,
    unreadablePaths: [],
    identityConflicts: state.scanIdentityConflicts,
    invalidMetaFiles: state.scanInvalidMetaFiles,
    candidates: state.scanCandidates.filter((candidate) => !excluded.has(candidate.path)),
    ...(state.dataIntegrityWarning ? { dataIntegrityWarning: state.dataIntegrityWarning } : {}),
  };
}

/** root配下にない作品をworksから外し、root配下に戻った作品をworksへ戻す。 */
function reattachWorksForRoot(state: FixtureState, rootFolder: string): void {
  const all = [...state.works, ...state.detachedWorks];
  state.works = all.filter((work) => isFsPathWithin(rootFolder, work.physicalPath));
  state.detachedWorks = all.filter((work) => !isFsPathWithin(rootFolder, work.physicalPath));
}

export function createSettingsScanMethods(
  state: FixtureState,
  options: { rootRebuildStepMs?: number } = {},
): SettingsAdapter & RootReconfigurationAdapter {
  const rootRebuildStepMs = options.rootRebuildStepMs ?? FIXTURE_ROOT_REBUILD_STEP_MS;
  return {
    async getSettings(): Promise<StoredSettings> {
      return {
        rootFolder: state.rootFolder,
        lastScanTime: state.lastScanTime,
      };
    },

    async resolveRootFolder(requested: string): Promise<string> {
      return normalizeFsPath(requested);
    },

    async getRootReconfigurationRecord(): Promise<RootReconfigurationRecord | null> {
      const record = state.rootReconfiguration;
      if (record === null) return null;
      if (state.rootFolder === null) throw new Error("再設定中のルートフォルダーがありません");
      return { ...record, rootFolder: state.rootFolder };
    },

    async beginRootReconfiguration(rootFolder: string): Promise<void> {
      if (state.rootFolder !== null && state.rootFolder !== rootFolder) {
        state.scanCandidateExclusions = [];
        state.scanCandidates = [];
      }
      state.rootFolder = rootFolder;
      state.rootReconfiguration = { phase: "running" };
    },

    async rebuildCatalogForRoot(rootFolder, rebuildOptions): Promise<ScanResult> {
      reattachWorksForRoot(state, rootFolder);
      if (rootFolder === FIXTURE_UNREADABLE_ROOT) {
        await sleep(rootRebuildStepMs);
        throw new Error(`ルートフォルダーを読み取れません: ${rootFolder}`);
      }
      return runPseudoScan(state, rebuildOptions, rootRebuildStepMs);
    },

    async failRootReconfiguration(message: string): Promise<void> {
      state.rootReconfiguration = { phase: "failed", message };
    },

    async completeRootReconfiguration(): Promise<void> {
      state.rootReconfiguration = null;
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanResult> {
      return runPseudoScan(state, scanOptions ?? {}, FIXTURE_SCAN_STEP_MS);
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
      // real adapter の registerCandidates（scanCandidateSession.ts）と同じ意味論: 登録した候補は
      // 実際にcatalog（ここではstate.works）へ行が増える。作品一覧・スキャン結果一覧の
      // 両方から見えて初めて「登録した」と言える。
      const registered = items.flatMap((item) => {
        const candidate = candidatesByPath.get(item.path);
        if (!candidate) return [];
        const rjCode = resolveRegisteredRjCode(candidate.rjCode, item.rjCode);
        const work: FixtureWorkRecord = {
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
        };
        state.works.push(work);
        setDlsiteLinkage(state, work.id, { rjCode, status: "none", appliedTags: [] });
        return [{ path: candidate.path, workId: work.id }];
      });
      const failures = items.flatMap((item) =>
        candidatesByPath.has(item.path)
          ? []
          : [{ path: workspacePath(item.path), message: "候補が見つかりません" }],
      );
      const registeredPaths = new Set(registered.map((candidate) => candidate.path));
      const unregistered = (candidate: ScanCandidate) => !registeredPaths.has(candidate.path);
      state.scanCandidatePool = state.scanCandidatePool.filter(unregistered);
      state.scanCandidates = state.scanCandidates.filter(unregistered);
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
