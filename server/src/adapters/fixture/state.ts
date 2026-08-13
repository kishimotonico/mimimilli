import { DEFAULT_TAG_PREFIXES } from "@mimimilli/shared";
import type {
  InvalidSidecar,
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
  works: WorkSummary[];
  /** 編集用カバー列（表示用 cover と独立。unmeasured を表現する） */
  coverColumns: Map<string, FixtureCoverColumns>;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  nextSmartFolderId: number;
  /** 作品ごとのレジューム位置 */
  resumes: Map<string, ResumeBody>;
  playbackIds: Map<string, PlaybackIds>;
  /** scan() が newWorkIds として返す、未取り込みの新規作品ID（シナリオ "new-work" 用） */
  scanNewWorkIds: string[];
  identityConflicts: ScanDiagnostic[];
  scanCandidates: ScanCandidate[];
  scanIdentityConflicts: ScanDiagnostic[];
  scanInvalidSidecars: InvalidSidecar[];
}

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
    works,
    coverColumns,
    tagPrefixes: DEFAULT_TAG_PREFIXES.map((def) => ({ ...def })),
    smartFolders: scenario.smartFolders,
    nextSmartFolderId: maxSmartFolderNum + 1,
    resumes: new Map(),
    playbackIds: new Map(),
    scanNewWorkIds: scenario.scanNewWorkIds,
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
    scanCandidates: scenario.scanCandidates,
    scanIdentityConflicts: scenario.scanIdentityConflicts,
    scanInvalidSidecars: scenario.scanInvalidSidecars,
  };
}

export function coverColumnsOf(state: FixtureState, workId: string): FixtureCoverColumns {
  return state.coverColumns.get(workId) ?? { image: null, dimensions: null };
}
