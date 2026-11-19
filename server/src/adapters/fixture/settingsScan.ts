import {
  META_FILE_NAME,
  dlsiteFetchStateOfResolution,
  planDlsiteRegistration,
  relativeToRoot,
  workspacePath,
} from "@mimimilli/shared";
import type {
  MissingWork,
  ScanCandidate,
  ScanCandidateDlsite,
  ScanCandidateFolder,
  ScanCandidatesRegisterResponse,
  ScanResult,
} from "@mimimilli/shared";
import type {
  RootReconfigurationAdapter,
  RootReconfigurationRecord,
  ScanOptions,
  SettingsAdapter,
  StoredSettings,
} from "../../adapter/index.ts";
import { CandidatePoolChangedError } from "../../errors.ts";
import type { FixtureWorkRecord } from "./data.ts";
import { isFsPathWithin, normalizeFsPath } from "./fsResolve.ts";
import { checkWorkPlacement } from "./playback.ts";
import { FIXTURE_UNREADABLE_ROOT } from "./scenarios.ts";
import {
  dlsiteLinkageOf,
  applyFixtureCachedCover,
  fixtureDlsiteCoverKey,
  fixtureDlsiteResolutionHead,
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

/** 直したコードがあればそれ、なければ検出したコード */
function effectiveRjCode(state: FixtureState, folder: ScanCandidateFolder): string | null {
  return state.scanCandidateRjCodeOverrides.has(folder.path)
    ? (state.scanCandidateRjCodeOverrides.get(folder.path) ?? null)
    : folder.detectedRjCode;
}

function deriveDlsite(state: FixtureState, rjCode: string | null): ScanCandidateDlsite {
  if (!rjCode) return { state: "none" };
  const fetchState = dlsiteFetchStateOfResolution(fixtureDlsiteResolutionHead(state, rjCode));
  if (fetchState !== "fetched") return { state: fetchState };
  const fetched = state.dlsiteFetched.get(rjCode.toUpperCase());
  if (!fetched) return { state: "none" };
  const key = fetched.info.coverUrl ? fixtureDlsiteCoverKey(fetched.info.coverUrl) : null;
  const cover = key ? state.dlsiteCovers.get(key) : undefined;
  return {
    state: "fetched",
    title: fetched.info.title,
    cover: key && cover ? { key, version: cover.fetchedAt } : null,
  };
}

function toCandidate(state: FixtureState, folder: ScanCandidateFolder): ScanCandidate {
  const rjCode = effectiveRjCode(state, folder);
  const missingWorks = rjCode
    ? state.works
        .filter(
          (work) =>
            work.status === "missing" &&
            dlsiteLinkageOf(state, work.id).rjCode?.toUpperCase() === rjCode,
        )
        .map((work) => ({ workId: work.id, title: work.title }))
    : [];
  return {
    path: folder.path,
    inferredTitle: folder.inferredTitle,
    audioFileCount: folder.audioFileCount,
    audioBreakdown: folder.audioBreakdown,
    rjCode,
    rjCodeEdited: state.scanCandidateRjCodeOverrides.has(folder.path),
    dlsite: deriveDlsite(state, rjCode),
    missingWorks,
  };
}

function visibleFolders(state: FixtureState): ScanCandidateFolder[] {
  const excluded = new Set(state.scanCandidateExclusions);
  return state.scanCandidates.filter((folder) => !excluded.has(folder.path));
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
): Promise<ScanResult> {
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

  const missingWorks = markScenarioMissingWorks(state);
  state.works = state.works.map((work) => checkWorkPlacement(state, work));
  state.lastScanTime = new Date().toISOString();
  state.scanCandidates = [...state.scanCandidatePool];
  state.scanCandidateRjCodeOverrides.clear();
  return {
    registered: state.works.length,
    insertedWorkIds: state.scanInsertedWorkIds,
    startedWithEmptyCatalog,
    missingWorks,
    updatedWorks: state.scanUpdatedWorks,
    errors: state.works.filter((w) => w.status === "error").length,
    missing: state.works.filter((w) => w.status === "missing").length,
    skipped: 0,
    coverErrors: 0,
    unreadablePaths: state.scanUnreadablePaths,
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
        state.scanCandidateRjCodeOverrides.clear();
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
      state.rootReconfigurationCompletedAt = new Date().toISOString();
    },

    async getRootReconfigurationCompletedAt(): Promise<string | null> {
      return state.rootReconfigurationCompletedAt;
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanResult> {
      return runPseudoScan(state, scanOptions ?? {}, FIXTURE_SCAN_STEP_MS);
    },

    async listScanDiagnostics() {
      return {
        identityConflicts: state.identityConflicts,
        invalidMetaFiles: state.invalidMetaFiles,
      };
    },
    async listScanCandidates(): Promise<ScanCandidate[]> {
      return visibleFolders(state).map((folder) => toCandidate(state, folder));
    },
    async setScanCandidateRjCode(path, rjCode): Promise<ScanCandidate> {
      const folder = visibleFolders(state).find((candidate) => candidate.path === path);
      if (!folder) throw new CandidatePoolChangedError();
      if (rjCode === folder.detectedRjCode) state.scanCandidateRjCodeOverrides.delete(path);
      else state.scanCandidateRjCodeOverrides.set(path, rjCode);
      return toCandidate(state, folder);
    },
    async registerScanCandidates(paths, apply): Promise<ScanCandidatesRegisterResponse> {
      const candidatesByPath = new Map<string, ScanCandidateFolder>(
        state.scanCandidates.map((candidate) => [candidate.path, candidate]),
      );
      const rootAbs = normalizeFsPath(requireFixtureRoot(state));
      const now = new Date().toISOString();
      // real adapter の registerCandidates（scanCandidateSession.ts）と同じ意味論: 登録した候補は
      // 実際にcatalog（ここではstate.works）へ行が増える。作品一覧・スキャン結果一覧の
      // 両方から見えて初めて「登録した」と言える。
      const registered = paths.flatMap((path) => {
        const candidate = candidatesByPath.get(path);
        if (!candidate) return [];
        const rjCode = state.scanCandidateRjCodeOverrides.has(candidate.path)
          ? (state.scanCandidateRjCodeOverrides.get(candidate.path) ?? "")
          : candidate.detectedRjCode;
        const plan = planDlsiteRegistration({
          rjCode,
          info: rjCode ? (fixtureUsableDlsite(state, rjCode)?.info ?? null) : null,
          title: candidate.inferredTitle,
          tags: [],
          apply,
        });
        const physicalPath = normalizeFsPath(`${rootAbs}/${candidate.path}`);
        const work: FixtureWorkRecord = {
          id: crypto.randomUUID(),
          title: plan.title,
          cover: null,
          status: "ok",
          physicalPath,
          metaPath: `${physicalPath}/${META_FILE_NAME}`,
          totalDurationSec: 0,
          trackCount: candidate.audioFileCount,
          addedAt: now,
          errorMessage: null,
          urls: plan.dlsiteUrl ? [plan.dlsiteUrl] : [],
          tags: plan.tags,
          bookmarked: false,
          lastPlayedAt: null,
        };
        applyFixtureCachedCover(state, work, plan.coverUrl);
        state.works.push(work);
        setDlsiteLinkage(state, work.id, plan.dlsite);
        return [{ path: candidate.path, workId: work.id }];
      });
      const failures = paths.flatMap((path) =>
        candidatesByPath.has(path)
          ? []
          : [{ path: workspacePath(path), message: "候補が見つかりません" }],
      );
      const registeredPaths = new Set(registered.map((candidate) => candidate.path));
      const unregistered = (candidate: ScanCandidateFolder) => !registeredPaths.has(candidate.path);
      for (const path of registeredPaths) state.scanCandidateRjCodeOverrides.delete(path);
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
