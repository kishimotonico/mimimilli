import { DEFAULT_TAG_PREFIXES } from "@mimimilli/shared";
import type {
  DataIntegrityWarning,
  InvalidMetaFile,
  ResumeBody,
  ScanCandidate,
  ScanDiagnostic,
  SmartFolder,
  TagPrefix,
  WorkSummary,
} from "@mimimilli/shared";
import { fixtureCoverColumnsForWork, type FixtureCoverColumns } from "./data.ts";
import { createFixtureScenario } from "./scenarios.ts";

/** 作品1件ぶんの安定したplaylist/track ID（呼び出しをまたいで同一IDを保つ） */
export interface PlaybackIds {
  playlists: Array<{ id: string; trackIds: string[] }>;
}

export interface FixtureState {
  rootFolder: string | null;
  lastScanTime: string | null;
  /** 直近の完了スキャンが対象にしたルートフォルダー。rootFolderと不一致なら一覧が未反映であることを示す */
  lastScanRootFolder: string | null;
  works: WorkSummary[];
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

/** dataIntegrityWarning のダミー除外対象workId（実在の works には含めない） */
const DATA_INTEGRITY_WARNING_SKIPPED_WORK_ID = "RJ501099";

export interface FixtureAdapterOptions {
  /** データシナリオ（省略時 "default"）。不明なIDはエラー */
  scenario?: string;
  /** 契約テスト用に差し替える作品一覧。省略時はscenarioのseedを使う。 */
  works?: WorkSummary[];
}

export function createInitialState(options: FixtureAdapterOptions): FixtureState {
  const now = new Date().toISOString();
  const scenario = createFixtureScenario(options.scenario, now);
  const maxSmartFolderNum = scenario.smartFolders.reduce((max, sf) => {
    const m = /^sf-(\d+)$/.exec(sf.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const works = options.works ?? scenario.works;
  const coverColumns = new Map<string, FixtureCoverColumns>();
  for (const work of works) {
    coverColumns.set(work.id, fixtureCoverColumnsForWork(work));
  }
  return {
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    lastScanRootFolder: scenario.rootFolder,
    works,
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
    sourceRevisions: new Map(works.map((work) => [work.id, "fixture"])),
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
