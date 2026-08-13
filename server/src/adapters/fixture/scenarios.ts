// fixture アダプタのシナリオ（ADR-0002 / client/mocks/scenarios.ts からの移植）。
// 開発サーバー・Playwright ビジュアルテストでのデータ切替に使う。
import {
  workspacePath,
  type InvalidMetaFile,
  type ScanCandidate,
  type ScanDiagnostic,
  type SmartFolder,
  type WorkSummary,
} from "@mimimilli/shared";
import { createBulkWorks } from "./bulkData.ts";
import { createSeedSmartFolders, SEED_WORKS } from "./data.ts";

export type FixtureScenarioId =
  | "default"
  | "empty"
  | "new-work"
  | "errors"
  | "large"
  | "scan-review";

const SCENARIO_IDS: readonly FixtureScenarioId[] = [
  "default",
  "empty",
  "new-work",
  "errors",
  "large",
  "scan-review",
];

/** "large" シナリオの総作品数（手書きシード + 生成分） */
export const LARGE_SCENARIO_WORK_COUNT = 1000;

export interface FixtureScenario {
  id: FixtureScenarioId;
  works: WorkSummary[];
  smartFolders: SmartFolder[];
  rootFolder: string | null;
  lastScanTime: string;
  /** scan() が insertedWorkIds として返す、新規に見つかった作品ID */
  scanInsertedWorkIds: string[];
  scanUpdatedWorkIds: string[];
  scanCandidates: ScanCandidate[];
  scanIdentityConflicts: ScanDiagnostic[];
  scanInvalidMetaFiles: InvalidMetaFile[];
}

function cloneWorks(works: WorkSummary[]): WorkSummary[] {
  return works.map((w) => ({ ...w, urls: w.urls.map((u) => ({ ...u })), tags: [...w.tags] }));
}

function cloneSmartFolders(folders: SmartFolder[]): SmartFolder[] {
  return folders.map((sf) => ({
    ...sf,
    rules: sf.rules.map((rule) => ({ ...rule, values: [...rule.values] })) as SmartFolder["rules"],
  }));
}

/** シナリオIDを検証する。不明なIDは黙って "default" にフォールバックせずエラーにする */
export function parseFixtureScenarioId(rawId: string | undefined): FixtureScenarioId {
  if (rawId === undefined) return "default";
  if ((SCENARIO_IDS as readonly string[]).includes(rawId)) {
    return rawId as FixtureScenarioId;
  }
  throw new Error(
    `不明な MIMIMILLI_MOCK_SCENARIO です: ${rawId}（指定可能な値: ${SCENARIO_IDS.join(", ")}）`,
  );
}

/** シナリオごとの初期データを構築する */
export function createFixtureScenario(rawId: string | undefined, now: string): FixtureScenario {
  const id = parseFixtureScenarioId(rawId);
  const smartFolders = createSeedSmartFolders(now);

  if (id === "empty") {
    return {
      id,
      works: [],
      smartFolders: [],
      rootFolder: "/library/empty-library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorkIds: [],
      scanCandidates: [],
      scanIdentityConflicts: [],
      scanInvalidMetaFiles: [],
    };
  }

  if (id === "new-work") {
    return {
      id,
      works: cloneWorks(SEED_WORKS),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanInsertedWorkIds: ["RJ501011"],
      scanUpdatedWorkIds: [],
      scanCandidates: [
        {
          path: workspacePath("未登録作品"),
          inferredTitle: "未登録作品",
          audioFileCount: 2,
          audioBreakdown: [{ extension: "mp3", count: 2 }],
          rjCode: null,
        },
        {
          path: workspacePath("朗読/候補"),
          inferredTitle: "候補",
          audioFileCount: 3,
          audioBreakdown: [{ extension: "m4a", count: 3 }],
          rjCode: null,
        },
      ],
      scanIdentityConflicts: [
        { kind: "identity_conflict", workId: "duplicate-id", paths: ["viewer", "dlsite"] },
      ],
      scanInvalidMetaFiles: [
        { path: workspacePath("壊れた/mimimilli.json"), message: "メタファイルが不正です" },
      ],
    };
  }

  if (id === "large") {
    return {
      id,
      works: [
        ...cloneWorks(SEED_WORKS),
        ...createBulkWorks(LARGE_SCENARIO_WORK_COUNT - SEED_WORKS.length),
      ],
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorkIds: [],
      scanCandidates: [],
      scanIdentityConflicts: [],
      scanInvalidMetaFiles: [],
    };
  }

  if (id === "errors") {
    return {
      id,
      works: cloneWorks(SEED_WORKS.filter((w) => w.status !== "ok")),
      smartFolders: [],
      rootFolder: "/library/error-library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorkIds: [],
      scanCandidates: [],
      scanIdentityConflicts: [],
      scanInvalidMetaFiles: [],
    };
  }

  if (id === "scan-review") {
    return {
      id,
      works: cloneWorks(SEED_WORKS),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorkIds: [],
      scanCandidates: [
        {
          path: workspacePath("未登録作品"),
          inferredTitle: "未登録作品",
          audioFileCount: 2,
          audioBreakdown: [{ extension: "mp3", count: 2 }],
          rjCode: null,
        },
        {
          path: workspacePath("朗読/候補"),
          inferredTitle: "候補",
          audioFileCount: 3,
          audioBreakdown: [{ extension: "m4a", count: 3 }],
          rjCode: null,
        },
      ],
      scanIdentityConflicts: [
        { kind: "identity_conflict", workId: "duplicate-id", paths: ["viewer", "dlsite"] },
      ],
      scanInvalidMetaFiles: [
        { path: workspacePath("壊れた/mimimilli.json"), message: "メタファイルが不正です" },
      ],
    };
  }

  return {
    id: "default",
    works: cloneWorks(SEED_WORKS),
    smartFolders: cloneSmartFolders(smartFolders),
    rootFolder: "/library",
    lastScanTime: now,
    scanInsertedWorkIds: [],
    scanUpdatedWorkIds: [],
    scanCandidates: [],
    scanIdentityConflicts: [],
    scanInvalidMetaFiles: [],
  };
}
