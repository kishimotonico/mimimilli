// fixture アダプタのシナリオ（ADR-0002 / client/mocks/scenarios.ts からの移植）。
// 開発サーバー・Playwright ビジュアルテストでのデータ切替に使う。
import {
  workspacePath,
  type DlsiteCacheResolution,
  type DataIntegrityWarning,
  type IdentityConflict,
  type InvalidMetaFile,
  type MetaDlsiteState,
  type ScanCandidateFolder,
  type UpdatedWork,
  type WorkspacePath,
  type SmartFolder,
} from "@mimimilli/shared";
import type { RootReconfigurationRecord } from "../../adapter/index.ts";
import { createBulkWorks } from "./bulkData.ts";
import {
  createSeedSmartFolders,
  buildSeedDlsiteFailures,
  SEED_DLSITE_LINKAGES,
  SEED_WORKS,
  SINGLE_FILE_SEED_IDENTITY_CONFLICT,
  SINGLE_FILE_SEED_WORK,
  type FixtureWorkRecord,
} from "./data.ts";

export type FixtureScenarioId =
  | "default"
  | "empty"
  | "new-work"
  | "identity-conflict"
  | "errors"
  | "large"
  | "scan-review"
  | "needs-attention"
  | "root-reconfiguration-failed";

export const SCENARIO_IDS: readonly FixtureScenarioId[] = [
  "default",
  "empty",
  "new-work",
  "identity-conflict",
  "errors",
  "large",
  "scan-review",
  "needs-attention",
  "root-reconfiguration-failed",
];

/** "large" シナリオの総作品数（手書きシード + 生成分） */
export const LARGE_SCENARIO_WORK_COUNT = 1000;

/** 予約パス。このrootへの再設定は構築段階で失敗する */
export const FIXTURE_UNREADABLE_ROOT = "/fixture/unreadable-library";

export type FixtureRootReconfiguration =
  | { phase: "running" }
  | Omit<Extract<RootReconfigurationRecord, { phase: "failed" }>, "rootFolder">;

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
  scanUpdatedWorks: UpdatedWork[];
  /** scan() が新たに行方不明にする作品ID */
  scanNewlyMissingWorkIds: string[];
  /** scan() が読み取れなかったとして返すroot相対path */
  scanUnreadablePaths: WorkspacePath[];
  scanCandidates: ScanCandidateFolder[];
  invalidMetaFiles: InvalidMetaFile[];
  identityConflicts: IdentityConflict[];
  /** 一覧から除外した作品の報告。スキャン結果と作品一覧に付く */
  dataIntegrityWarning?: DataIntegrityWarning;
  /** rootの配下にないためcatalogから外れている作品。rootを戻すと同じIDで一覧へ戻る */
  detachedWorks: FixtureWorkRecord[];
  rootReconfiguration: FixtureRootReconfiguration | null;
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
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [],
      invalidMetaFiles: [],
      identityConflicts: [],
      detachedWorks: [],
      rootReconfiguration: null,
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
      // DLsite列の連携済み(RJ501001)・未連携(RJ501011・RJ501003の取得失敗)を一通り確認できるよう、
      // 新規作品に含める。スキップ(RJ501007)は更新済みに含める
      scanInsertedWorkIds: ["RJ501011", "RJ501001", "RJ501003"],
      scanUpdatedWorks: [
        {
          workId: "RJ501007",
          changes: [
            {
              kind: "moved",
              from: workspacePath("旧フォルダー/RJ501007"),
              to: workspacePath("RJ501007"),
            },
            { kind: "meta" },
          ],
        },
        { workId: "RJ501002", changes: [{ kind: "files", audioDelta: 3 }] },
        { workId: "RJ501004", changes: [{ kind: "meta" }, { kind: "files", audioDelta: 0 }] },
      ],
      scanNewlyMissingWorkIds: ["RJ501008"],
      scanUnreadablePaths: [workspacePath("権限なし/フォルダー")],
      scanCandidates: [
        {
          path: workspacePath("未登録作品"),
          inferredTitle: "未登録作品",
          audioFileCount: 2,
          audioBreakdown: [{ extension: "mp3", count: 2 }],
          detectedRjCode: null,
        },
        {
          path: workspacePath("朗読/候補"),
          inferredTitle: "候補",
          audioFileCount: 3,
          audioBreakdown: [{ extension: "m4a", count: 3 }],
          detectedRjCode: null,
        },
      ],
      invalidMetaFiles: [
        {
          path: workspacePath("壊れた/mimimilli.json"),
          message: "mimimilli.json 4行目: カンマが足りない",
        },
      ],
      identityConflicts: [
        {
          kind: "identity_conflict",
          workId: "RJ501001",
          paths: [
            workspacePath("dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読"),
            workspacePath("copies/RJ501001_夜更けの図書室で囁き朗読"),
          ],
        },
      ],
      detachedWorks: [],
      rootReconfiguration: null,
    };
  }

  if (id === "identity-conflict") {
    return {
      id,
      works: [...cloneWorks(SEED_WORKS), ...cloneWorks([SINGLE_FILE_SEED_WORK])],
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [],
      invalidMetaFiles: [],
      identityConflicts: [
        {
          ...SINGLE_FILE_SEED_IDENTITY_CONFLICT,
          paths: [...SINGLE_FILE_SEED_IDENTITY_CONFLICT.paths],
        },
      ],
      detachedWorks: [],
      rootReconfiguration: null,
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
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [],
      invalidMetaFiles: [],
      identityConflicts: [],
      detachedWorks: [],
      rootReconfiguration: null,
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
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [],
      invalidMetaFiles: [],
      identityConflicts: [],
      dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["RJ501099"] },
      detachedWorks: [],
      rootReconfiguration: null,
    };
  }

  if (id === "needs-attention") {
    return {
      id,
      works: cloneWorks(SEED_WORKS),
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: ["RJ501008"],
      scanUnreadablePaths: [workspacePath("権限なし/フォルダー")],
      scanCandidates: [],
      invalidMetaFiles: [
        {
          path: workspacePath("壊れた/mimimilli.json"),
          message: "mimimilli.json 4行目: カンマが足りない",
        },
      ],
      identityConflicts: [
        {
          kind: "identity_conflict",
          workId: "RJ501001",
          paths: [
            workspacePath("dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読"),
            workspacePath("copies/RJ501001_夜更けの図書室で囁き朗読"),
          ],
        },
      ],
      dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["RJ501099"] },
      detachedWorks: [],
      rootReconfiguration: null,
    };
  }

  if (id === "root-reconfiguration-failed") {
    return {
      id,
      works: [],
      dlsiteLinkages: cloneDlsiteLinkages(),
      dlsiteFetchFailures: cloneDlsiteFailures(nowMs),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: FIXTURE_UNREADABLE_ROOT,
      lastScanTime: now,
      scanInsertedWorkIds: [],
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [],
      invalidMetaFiles: [],
      identityConflicts: [],
      detachedWorks: cloneWorks(SEED_WORKS),
      rootReconfiguration: {
        phase: "failed",
        message: `ルートフォルダーを読み取れません: ${FIXTURE_UNREADABLE_ROOT}`,
      },
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
      scanUpdatedWorks: [],
      scanNewlyMissingWorkIds: [],
      scanUnreadablePaths: [],
      scanCandidates: [
        {
          path: workspacePath("未登録作品"),
          inferredTitle: "未登録作品",
          audioFileCount: 2,
          audioBreakdown: [{ extension: "mp3", count: 2 }],
          detectedRjCode: null,
        },
        {
          path: workspacePath("朗読/候補"),
          inferredTitle: "候補",
          audioFileCount: 3,
          audioBreakdown: [{ extension: "m4a", count: 3 }],
          detectedRjCode: null,
        },
        {
          path: workspacePath("RJ000401_囁きの図書館"),
          inferredTitle: "囁きの図書館",
          audioFileCount: 4,
          audioBreakdown: [{ extension: "mp3", count: 4 }],
          detectedRjCode: "RJ000401",
        },
        {
          path: workspacePath("RJ000402_カバーなし作品"),
          inferredTitle: "カバーなし作品",
          audioFileCount: 2,
          audioBreakdown: [{ extension: "mp3", count: 2 }],
          detectedRjCode: "RJ000402",
        },
        {
          path: workspacePath("RJ000403_見つからない作品"),
          inferredTitle: "見つからない作品",
          audioFileCount: 3,
          audioBreakdown: [{ extension: "mp3", count: 3 }],
          detectedRjCode: "RJ000403",
        },
        {
          path: workspacePath("RJ000404_取得に失敗する作品"),
          inferredTitle: "取得に失敗する作品",
          audioFileCount: 1,
          audioBreakdown: [{ extension: "mp3", count: 1 }],
          detectedRjCode: "RJ000404",
        },
        {
          path: workspacePath("RJ000405_夜更けの朗読"),
          inferredTitle: "夜更けの朗読",
          audioFileCount: 5,
          audioBreakdown: [{ extension: "mp3", count: 5 }],
          detectedRjCode: "RJ000405",
        },
        {
          path: workspacePath("RJ501010_朗読劇"),
          inferredTitle: "朗読劇",
          audioFileCount: 4,
          audioBreakdown: [{ extension: "mp3", count: 4 }],
          detectedRjCode: "RJ501010",
        },
      ],
      invalidMetaFiles: [
        {
          path: workspacePath("壊れた/mimimilli.json"),
          message: "mimimilli.json 4行目: カンマが足りない",
        },
      ],
      identityConflicts: [],
      detachedWorks: [],
      rootReconfiguration: null,
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
    scanUpdatedWorks: [],
    scanNewlyMissingWorkIds: [],
    scanUnreadablePaths: [],
    scanCandidates: [],
    invalidMetaFiles: [],
    identityConflicts: [],
    detachedWorks: [],
    rootReconfiguration: null,
  };
}
