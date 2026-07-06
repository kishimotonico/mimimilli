// fixture アダプタのシナリオ（ADR-0002 / client/mocks/scenarios.ts からの移植）。
// 開発サーバー・Playwright ビジュアルテストでのデータ切替に使う。
import type { SearchPreset, SmartFolder, WorkSummary } from "@mimimilli/shared";
import { createSeedSmartFolders, SEED_PRESETS, SEED_WORKS } from "./data.ts";

export type FixtureScenarioId = "default" | "empty" | "new-work" | "errors";

const SCENARIO_IDS: readonly FixtureScenarioId[] = ["default", "empty", "new-work", "errors"];

export interface FixtureScenario {
  id: FixtureScenarioId;
  works: WorkSummary[];
  presets: SearchPreset[];
  smartFolders: SmartFolder[];
  rootFolder: string | null;
  lastScanTime: string;
  /** scan() が newWorkIds として返す、新規に見つかった作品ID */
  scanNewWorkIds: string[];
}

function cloneWorks(works: WorkSummary[]): WorkSummary[] {
  return works.map((w) => ({ ...w, urls: w.urls.map((u) => ({ ...u })), tags: [...w.tags] }));
}

function clonePresets(presets: SearchPreset[]): SearchPreset[] {
  return presets.map((p) => ({ ...p, tagFilters: [...p.tagFilters] }));
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
      presets: [],
      smartFolders: [],
      rootFolder: "/library/empty-library",
      lastScanTime: now,
      scanNewWorkIds: [],
    };
  }

  if (id === "new-work") {
    return {
      id,
      works: cloneWorks(SEED_WORKS),
      presets: clonePresets(SEED_PRESETS),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/library",
      lastScanTime: now,
      scanNewWorkIds: ["RJ501011"],
    };
  }

  if (id === "errors") {
    return {
      id,
      works: cloneWorks(SEED_WORKS.filter((w) => w.status !== "ok")),
      presets: [],
      smartFolders: [],
      rootFolder: "/library/error-library",
      lastScanTime: now,
      scanNewWorkIds: [],
    };
  }

  return {
    id: "default",
    works: cloneWorks(SEED_WORKS),
    presets: clonePresets(SEED_PRESETS),
    smartFolders: cloneSmartFolders(smartFolders),
    rootFolder: "/library",
    lastScanTime: now,
    scanNewWorkIds: [],
  };
}
