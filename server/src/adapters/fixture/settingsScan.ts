import { META_FILE_NAME, planDlsiteRegistration, relativeToRoot } from "@mimimilli/shared";
import type { MissingWork, ScanCandidateFolder, ScanResult } from "@mimimilli/shared";
import type {
  CandidateAvailability,
  CandidateDescriber,
  RootReconfigurationAdapter,
  RootReconfigurationRecord,
  ScanExecution,
  ScanOptions,
  SettingsAdapter,
  StoredSettings,
} from "../../adapter/index.ts";
import type { FixtureWorkRecord } from "./data.ts";
import { isFsPathWithin, normalizeFsPath } from "./fsResolve.ts";
import { checkWorkPlacement } from "./playback.ts";
import { FIXTURE_UNREADABLE_ROOT } from "./scenarios.ts";
import {
  dlsiteLinkageOf,
  applyFixtureCachedCover,
  fixtureDlsiteSummary,
  fixtureUsableDlsite,
  requireFixtureRoot,
  setDlsiteLinkage,
  type FixtureState,
} from "./state.ts";

const FIXTURE_SCAN_STEP_MS = 20;
const FIXTURE_ROOT_REBUILD_STEP_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeMissingWorks(state: FixtureState, rjCode: string | null) {
  if (!rjCode) return [];
  return state.works
    .filter(
      (work) =>
        work.status === "missing" &&
        dlsiteLinkageOf(state, work.id).rjCode?.toUpperCase() === rjCode,
    )
    .map((work) => ({ workId: work.id, title: work.title }));
}

/** 除外と、登録済み作品（自分自身か祖先フォルダー）の候補を除く。登録状況の正は作品一覧 */
function availabilityOf(state: FixtureState): CandidateAvailability {
  const excluded = new Set(state.scanCandidateExclusions);
  const rootAbs = normalizeFsPath(requireFixtureRoot(state));
  const workPaths = state.works.map((work) => normalizeFsPath(work.physicalPath));
  return (folder) => {
    if (excluded.has(folder.path)) return false;
    const folderAbs = normalizeFsPath(`${rootAbs}/${folder.path}`);
    return !workPaths.some((workPath) => isFsPathWithin(workPath, folderAbs));
  };
}

/** 作品（自分自身か祖先フォルダー）に覆われたフォルダーは候補プールに入らない（realの走査と同じ） */
function candidatePoolOf(state: FixtureState): ScanCandidateFolder[] {
  const rootAbs = normalizeFsPath(requireFixtureRoot(state));
  const workPaths = state.works.map((work) => normalizeFsPath(work.physicalPath));
  return state.scanCandidatePool.filter((folder) => {
    const folderAbs = normalizeFsPath(`${rootAbs}/${folder.path}`);
    return !workPaths.some((workPath) => isFsPathWithin(workPath, folderAbs));
  });
}

/** シナリオが指定した作品を行方不明にし、今回新たに行方不明になった作品として返す。 */
function markScenarioMissingWorks(state: FixtureState): MissingWork[] {
  const rootAbs = normalizeFsPath(requireFixtureRoot(state));
  const missingWorks: MissingWork[] = [];
  for (const work of state.works) {
    if (!state.scanNewlyMissingWorkIds.includes(work.id) || work.status === "missing") continue;
    missingWorks.push({
      workId: work.id,
      title: work.title,
      previousPath: relativeToRoot(work.physicalPath, rootAbs),
    });
    work.status = "missing";
    work.errorMessage = null;
  }
  return missingWorks;
}

async function runPseudoScan(
  state: FixtureState,
  options: ScanOptions,
  stepMs: number,
): Promise<ScanExecution> {
  const emit = options.onProgress ?? ((): void => {});
  const checkAbort = () => {
    if (options.signal?.aborted)
      throw new DOMException("スキャンはキャンセルされました", "AbortError");
  };
  const pseudoSteps = 4;
  const startedWithEmptyCatalog = state.works.length === 0;

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

  const scenario = !state.scanScenarioDelivered;
  state.scanScenarioDelivered = true;
  const missingWorks = scenario ? markScenarioMissingWorks(state) : [];
  state.works = state.works.map((work) => checkWorkPlacement(state, work));
  state.lastScanTime = new Date().toISOString();
  const result: ScanResult = {
    registered: state.works.length,
    insertedWorkIds: scenario ? state.scanInsertedWorkIds : [],
    startedWithEmptyCatalog,
    missingWorks,
    updatedWorks: scenario ? state.scanUpdatedWorks : [],
    errors: state.works.filter((w) => w.status === "error").length,
    missing: state.works.filter((w) => w.status === "missing").length,
    skipped: 0,
    coverErrors: 0,
    unreadablePaths: scenario ? state.scanUnreadablePaths : [],
    ...(scenario && state.dataIntegrityWarning
      ? { dataIntegrityWarning: state.dataIntegrityWarning }
      : {}),
  };
  return {
    result,
    candidatePool: candidatePoolOf(state),
    rootIdentity: normalizeFsPath(requireFixtureRoot(state)),
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

    async beginRootReconfiguration(rootFolder: string): Promise<{ rootChanged: boolean }> {
      const rootChanged = state.rootFolder !== null && state.rootFolder !== rootFolder;
      if (rootChanged) state.scanCandidateExclusions = [];
      state.rootFolder = rootFolder;
      state.rootReconfiguration = { phase: "running" };
      return { rootChanged };
    },

    async rebuildCatalogForRoot(rootFolder, rebuildOptions): Promise<ScanExecution> {
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
      state.rootReconfigurationCompletedAt = new Date().toISOString();
    },

    async getRootReconfigurationCompletedAt(): Promise<string | null> {
      return state.rootReconfigurationCompletedAt;
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanExecution> {
      return runPseudoScan(state, scanOptions ?? {}, FIXTURE_SCAN_STEP_MS);
    },

    async listScanDiagnostics() {
      return {
        identityConflicts: state.identityConflicts,
        invalidMetaFiles: state.invalidMetaFiles,
      };
    },
    async candidateRootIdentity(): Promise<string | null> {
      return state.rootFolder === null ? null : normalizeFsPath(state.rootFolder);
    },
    async candidateAvailability(): Promise<CandidateAvailability> {
      return availabilityOf(state);
    },
    async describeCandidates(): Promise<CandidateDescriber> {
      return (rjCode) => ({
        dlsite: fixtureDlsiteSummary(state, rjCode),
        missingWorks: describeMissingWorks(state, rjCode),
      });
    },
    async registerCandidateFolder(folder, rjCode, apply) {
      const rootAbs = normalizeFsPath(requireFixtureRoot(state));
      const plan = planDlsiteRegistration({
        rjCode,
        info: rjCode ? (fixtureUsableDlsite(state, rjCode)?.info ?? null) : null,
        title: folder.inferredTitle,
        tags: [],
        apply,
      });
      const physicalPath = normalizeFsPath(`${rootAbs}/${folder.path}`);
      const work: FixtureWorkRecord = {
        id: crypto.randomUUID(),
        title: plan.title,
        cover: null,
        status: "ok",
        physicalPath,
        metaPath: `${physicalPath}/${META_FILE_NAME}`,
        totalDurationSec: 0,
        trackCount: folder.audioFileCount,
        addedAt: new Date().toISOString(),
        errorMessage: null,
        urls: plan.dlsiteUrl ? [plan.dlsiteUrl] : [],
        tags: plan.tags,
        bookmarked: false,
        lastPlayedAt: null,
      };
      const coverSkipped = applyFixtureCachedCover(state, work, plan.coverUrl);
      state.works.push(work);
      setDlsiteLinkage(state, work.id, plan.dlsite);
      return { workId: work.id, coverSkipped };
    },
    async excludeScanCandidates(paths): Promise<void> {
      // 除外は可逆な扱い（restoreScanCandidateExclusionsで戻せる）なので、候補プールからは外さない
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
