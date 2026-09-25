import { DEFAULT_TAG_PREFIXES, projectDlsiteState, toDlsiteLinkageStatus } from "@mimimilli/shared";
import type {
  DataIntegrityWarning,
  DlsiteCacheResolution,
  InvalidMetaFile,
  MetaDlsiteState,
  ResumeBody,
  ScanCandidate,
  ScanDiagnostic,
  SmartFolder,
  TagPrefix,
  WorkSummary,
} from "@mimimilli/shared";
import {
  fixtureCoverColumnsForWork,
  type FixtureCoverColumns,
  type FixtureWorkRecord,
} from "./data.ts";
import { createFixtureScenario, type FixtureRootReconfiguration } from "./scenarios.ts";

/** rjCodeをDLsite取得キャッシュのキーとして正規化する（realのnormalizeDlsiteProductCodeに合わせ大文字化）。 */
function normalizeDlsiteCacheKey(rjCode: string): string {
  return rjCode.trim().toUpperCase();
}

const EMPTY_META_DLSITE_STATE: MetaDlsiteState = { rjCode: null, status: "none", appliedTags: [] };

/** 作品1件ぶんの安定したplaylist/track ID（呼び出しをまたいで同一IDを保つ） */
export interface PlaybackIds {
  playlists: Array<{ id: string; trackIds: string[] }>;
}

export interface FixtureState {
  rootFolder: string | null;
  lastScanTime: string | null;
  /** 永続化された再設定状態（realのuser DB app_settings.root_reconfiguration相当）。null は通常運用 */
  rootReconfiguration: FixtureRootReconfiguration | null;
  /** 直近の再設定が完了した時刻（realのapp_settings.root_reconfiguration_completed_at相当）。
   *  一度も完了していなければnull。 */
  rootReconfigurationCompletedAt: string | null;
  /** DLsite合成状態（dlsite）を含まない作品レコード。正本は works・dlsiteLinkages・
   *  dlsiteFetchFailures の3つで、合成済みのAPI向け状態はどこにも保存しない。 */
  works: FixtureWorkRecord[];
  /** rootの配下にないためcatalog相当の works から外した作品。物理ファイルの代わりで、user状態ごと保持する */
  detachedWorks: FixtureWorkRecord[];
  /** workIdごとのDLsite連携分類（meta linkage相当）。realのmimimilli.json.dlsiteに対応する。 */
  dlsiteLinkages: Map<string, MetaDlsiteState>;
  /** rjCodeごとのDLsite取得キャッシュ相当。realのDlsiteCacheに対応する。 */
  dlsiteFetchFailures: Map<string, DlsiteCacheResolution>;
  /** 編集用カバー列（表示用 cover と独立。unmeasured を表現する） */
  coverColumns: Map<string, FixtureCoverColumns>;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  nextSmartFolderId: number;
  /** 作品ごとのレジューム位置 */
  resumes: Map<string, ResumeBody>;
  playbackIds: Map<string, PlaybackIds>;
  /** scan() が insertedWorkIds として返す、未取り込みの新規作品ID（シナリオ "new-work" 用） */
  scanInsertedWorkIds: string[];
  /** scan() が updatedWorkIds として返す作品ID */
  scanUpdatedWorkIds: string[];
  /** 永続化された候補除外パス */
  scanCandidateExclusions: string[];
  identityConflicts: ScanDiagnostic[];
  /** scan() が見つける候補。rootを変えても変わらない（fixtureには物理FSがない） */
  scanCandidatePool: ScanCandidate[];
  /** 直近のscan以降に有効な候補session。root変更で破棄し、次のscanで作り直す */
  scanCandidates: ScanCandidate[];
  scanIdentityConflicts: ScanDiagnostic[];
  scanInvalidMetaFiles: InvalidMetaFile[];
  /** listSummaries でタグ等の不整合により除外した作品の報告（シナリオ errors のみ） */
  dataIntegrityWarning: DataIntegrityWarning | undefined;
  /** 編集 snapshot の CAS トークン（ファイルが無い fixture 用） */
  sourceRevisions: Map<string, string>;
  sourceRevisionSeq: number;
}

/** workIdのDLsite連携分類。未登録はnone。 */
export function dlsiteLinkageOf(state: FixtureState, workId: string): MetaDlsiteState {
  return state.dlsiteLinkages.get(workId) ?? EMPTY_META_DLSITE_STATE;
}

export function setDlsiteLinkage(
  state: FixtureState,
  workId: string,
  linkage: MetaDlsiteState,
): void {
  state.dlsiteLinkages.set(workId, linkage);
}

/** works からidが一致するレコードを取り除き、dlsiteLinkagesの対応エントリも消す。 */
export function removeWorks(state: FixtureState, ids: ReadonlySet<string>): void {
  if (ids.size === 0) return;
  state.works = state.works.filter((work) => !ids.has(work.id));
  for (const id of ids) state.dlsiteLinkages.delete(id);
}

/** workのidを付け替え、dlsiteLinkagesも新idへ移す。 */
export function reassignWorkId(state: FixtureState, oldId: string, newId: string): void {
  setDlsiteLinkage(state, newId, dlsiteLinkageOf(state, oldId));
  state.dlsiteLinkages.delete(oldId);
}

/** rjCodeに対応するDLsite取得キャッシュの解決結果。realのDlsiteCache.resolveと同じくTTL切れはmiss扱い。 */
export function dlsiteFetchFailureFor(
  state: FixtureState,
  rjCode: string | null,
): DlsiteCacheResolution | null {
  if (rjCode === null || rjCode === "") return null;
  const entry = state.dlsiteFetchFailures.get(normalizeDlsiteCacheKey(rjCode));
  if (!entry || entry.kind === "miss") return null;
  return entry.expiresAt > Date.now() ? entry : null;
}

/** 作品レコードとlinkage・取得キャッシュから、API向けの合成済みWorkSummaryを読み出し時に組み立てる。
 *  合成結果はどこにも保存しない。 */
export function composeWork(state: FixtureState, record: FixtureWorkRecord): WorkSummary {
  const { metaPath: _metaPath, ...summary } = record;
  const linkage = dlsiteLinkageOf(state, record.id);
  return {
    ...summary,
    dlsite: projectDlsiteState(linkage, dlsiteFetchFailureFor(state, linkage.rjCode)),
  };
}

export function composeWorks(state: FixtureState): WorkSummary[] {
  return state.works.map((record) => composeWork(state, record));
}

/** dataIntegrityWarning のダミー除外対象workId（実在の works には含めない） */
const DATA_INTEGRITY_WARNING_SKIPPED_WORK_ID = "RJ501099";

/** 契約テスト用の作品。fixture の作品レコードと同じく metaPath を持つ */
export type FixtureSeedWork = WorkSummary & { metaPath: string };

export interface FixtureAdapterOptions {
  /** データシナリオ（省略時 "default"）。不明なIDはエラー */
  scenario?: string;
  /** 再設定の構築段階1ステップあたりの待ち時間。再設定中の状態と進捗を観測できるよう既定では長めにする */
  rootRebuildStepMs?: number;
  /** 契約テスト用に差し替える作品一覧。省略時はscenarioのseedを使う。dlsiteはrjCode/status/appliedTags
   *  （linkage相当）だけを取り出して使い、lastAttemptAt/error/errorKindは読まない。 */
  works?: FixtureSeedWork[];
  /** works差し替え時に、rjCodeごとのDLsite取得キャッシュ相当を明示的に与える（省略時は空）。 */
  dlsiteFetchFailures?: ReadonlyArray<{ rjCode: string; resolution: DlsiteCacheResolution }>;
}

export function createInitialState(options: FixtureAdapterOptions): FixtureState {
  const now = new Date().toISOString();
  const scenario = createFixtureScenario(options.scenario, now);
  const maxSmartFolderNum = scenario.smartFolders.reduce((max, sf) => {
    const m = /^sf-(\d+)$/.exec(sf.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  let works: FixtureWorkRecord[];
  let detachedWorks: FixtureWorkRecord[];
  let dlsiteLinkages: Map<string, MetaDlsiteState>;
  let dlsiteFetchFailures: Map<string, DlsiteCacheResolution>;
  if (options.works) {
    works = options.works.map(({ dlsite: _dlsite, ...record }) => record);
    detachedWorks = [];
    dlsiteLinkages = new Map(
      options.works.map((work) => [
        work.id,
        {
          rjCode: work.dlsite.rjCode,
          status: toDlsiteLinkageStatus(work.dlsite.status),
          appliedTags: work.dlsite.appliedTags,
        },
      ]),
    );
    dlsiteFetchFailures = new Map(
      (options.dlsiteFetchFailures ?? []).map((entry) => [
        normalizeDlsiteCacheKey(entry.rjCode),
        entry.resolution,
      ]),
    );
  } else {
    works = scenario.works;
    detachedWorks = scenario.detachedWorks;
    dlsiteLinkages = scenario.dlsiteLinkages;
    dlsiteFetchFailures = scenario.dlsiteFetchFailures;
  }

  const coverColumns = new Map<string, FixtureCoverColumns>();
  for (const work of [...works, ...detachedWorks]) {
    coverColumns.set(work.id, fixtureCoverColumnsForWork(work));
  }
  return {
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    rootReconfiguration: scenario.rootReconfiguration,
    rootReconfigurationCompletedAt: null,
    works,
    detachedWorks,
    dlsiteLinkages,
    dlsiteFetchFailures,
    coverColumns,
    tagPrefixes: DEFAULT_TAG_PREFIXES.map((def) => ({ ...def })),
    smartFolders: scenario.smartFolders,
    nextSmartFolderId: maxSmartFolderNum + 1,
    resumes: new Map(),
    playbackIds: new Map(),
    scanInsertedWorkIds: scenario.scanInsertedWorkIds,
    scanUpdatedWorkIds: scenario.scanUpdatedWorkIds,
    scanCandidateExclusions: [],
    identityConflicts:
      scenario.id === "new-work"
        ? [
            {
              kind: "identity_conflict",
              workId: "RJ501001",
              paths: [
                "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
                "copies/RJ501001_夜更けの図書室で囁き朗読",
              ],
            },
          ]
        : [],
    scanCandidatePool: scenario.scanCandidates,
    scanCandidates: scenario.scanCandidates,
    scanIdentityConflicts: scenario.scanIdentityConflicts,
    scanInvalidMetaFiles: scenario.scanInvalidMetaFiles,
    dataIntegrityWarning:
      scenario.id === "errors"
        ? { skippedCount: 1, skippedWorkIds: [DATA_INTEGRITY_WARNING_SKIPPED_WORK_ID] }
        : undefined,
    sourceRevisions: new Map([...works, ...detachedWorks].map((work) => [work.id, "fixture"])),
    sourceRevisionSeq: 0,
  };
}

export function coverColumnsOf(state: FixtureState, workId: string): FixtureCoverColumns {
  return state.coverColumns.get(workId) ?? { image: null, dimensions: null };
}

/** state を options で作り直した初期状態へ書き戻す（同一オブジェクト参照を保つ）。 */
export function resetState(state: FixtureState, options: FixtureAdapterOptions): void {
  Object.assign(state, createInitialState(options));
}
