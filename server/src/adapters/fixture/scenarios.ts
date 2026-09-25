// fixture アダプタのシナリオ（ADR-0002 / client/mocks/scenarios.ts からの移植）。
// 開発サーバー・Playwright ビジュアルテストでのデータ切替に使う。
import {
  workspacePath,
  type DlsiteCacheResolution,
  type InvalidMetaFile,
  type MetaDlsiteState,
  type ScanCandidate,
  type ScanDiagnostic,
  type SmartFolder,
} from "@mimimilli/shared";
import { createBulkWorks } from "./bulkData.ts";
import {
  createSeedSmartFolders,
  buildSeedDlsiteFailures,
  SEED_DLSITE_LINKAGES,
  SEED_WORKS,
  type FixtureWorkRecord,
} from "./data.ts";

export type FixtureScenarioId =
  | "default"
  | "empty"
  | "new-work"
  | "errors"
  | "large"
  | "scan-review";

export const SCENARIO_IDS: readonly FixtureScenarioId[] = [
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
  works: FixtureWorkRecord[];
  dlsiteLinkages: Map<string, MetaDlsiteState>;
  dlsiteFetchFailures: Map<string, DlsiteCacheResolution>;
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

function cloneWorks(works: FixtureWorkRecord[]): FixtureWorkRecord[] {
  return works.map((w) => ({ ...w, urls: w.urls.map((u) => ({ ...u })), tags: [...w.tags] }));
}

function cloneDlsiteLinkages(): Map<string, MetaDlsiteState> {
  return new Map(SEED_DLSITE_LINKAGES);
}

function cloneDlsiteFailures(nowMs: number): Map<string, DlsiteCacheResolution> {
  return buildSeedDlsiteFailures(nowMs);
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
  const nowMs = Date.parse(now);

  if (id === "empty") {
    return {
      id,
      works: [],
      dlsiteLinkages: new Map(),
      dlsiteFetchFailures: new Map(),
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
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      // 外部連携列の状態を一通り確認できるよう、取得待ち(RJ501011)・連携済み(RJ501001)・
      // 失敗(RJ501003)を新規登録済みに、スキップ(RJ501007)を更新された作品に含める
      scanInsertedWorkIds: ["RJ501011", "RJ501001", "RJ501003"],
      scanUpdatedWorkIds: ["RJ501007"],
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
    const bulk = createBulkWorks(LARGE_SCENARIO_WORK_COUNT - SEED_WORKS.length, nowMs);
    const dlsiteLinkages = cloneDlsiteLinkages();
    const dlsiteFetchFailures = cloneDlsiteFailures(nowMs);
    for (const [workId, linkage] of bulk.linkages) dlsiteLinkages.set(workId, linkage);
    for (const [rjCode, failure] of bulk.failures) dlsiteFetchFailures.set(rjCode, failure);
    return {
      id,
      works: [...cloneWorks(SEED_WORKS), ...bulk.works],
      dlsiteLinkages,
      dlsiteFetchFailures,
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
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
      smartFolders: [],
      // SEED_WORKS の physicalPath は "/library/..." 固定なのでrootFolderも合わせる。
      rootFolder: "/library",
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
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
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
    dlsiteLinkages: cloneDlsiteLinkages(),
    dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
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
