import {
  INITIAL_PRESETS,
  INITIAL_WORKS,
  createInitialSmartFolders,
  type SearchPresetMock,
  type SmartFolderMock,
  type WorkSummaryMock,
} from "./fixtures/index";

export type MockScenarioId = "default" | "empty" | "new-work" | "errors";

export interface MockScenario {
  id: MockScenarioId;
  works: WorkSummaryMock[];
  presets: SearchPresetMock[];
  smartFolders: SmartFolderMock[];
  rootFolder: string | null;
  lastScanTime: string;
  scanNewWorkIds: string[];
}

function cloneWorks(works: WorkSummaryMock[]): WorkSummaryMock[] {
  return works.map((w) => ({ ...w, urls: [...w.urls], tags: [...w.tags] }));
}

function clonePresets(presets: SearchPresetMock[]): SearchPresetMock[] {
  return presets.map((p) => ({ ...p, tagFilters: [...p.tagFilters] }));
}

function cloneSmartFolders(folders: SmartFolderMock[]): SmartFolderMock[] {
  return folders.map((sf) => ({
    ...sf,
    rules: sf.rules.map((rule) => ({ ...rule, values: [...rule.values] })),
  }));
}

export function createMockScenario(rawId: string | undefined, now: string): MockScenario {
  const id = parseScenarioId(rawId);
  const smartFolders = createInitialSmartFolders(now);

  if (id === "empty") {
    return {
      id,
      works: [],
      presets: [],
      smartFolders: [],
      rootFolder: "/mock/empty-library",
      lastScanTime: now,
      scanNewWorkIds: [],
    };
  }

  if (id === "new-work") {
    return {
      id,
      works: cloneWorks(INITIAL_WORKS),
      presets: clonePresets(INITIAL_PRESETS),
      smartFolders: cloneSmartFolders(smartFolders),
      rootFolder: "/mock/library",
      lastScanTime: now,
      scanNewWorkIds: ["RJ460011"],
    };
  }

  if (id === "errors") {
    return {
      id,
      works: cloneWorks(INITIAL_WORKS.filter((w) => w.status !== "ok")),
      presets: [],
      smartFolders: [],
      rootFolder: "/mock/error-library",
      lastScanTime: now,
      scanNewWorkIds: [],
    };
  }

  return {
    id: "default",
    works: cloneWorks(INITIAL_WORKS),
    presets: clonePresets(INITIAL_PRESETS),
    smartFolders: cloneSmartFolders(smartFolders),
    rootFolder: "/mock/library",
    lastScanTime: now,
    scanNewWorkIds: [],
  };
}

function parseScenarioId(rawId: string | undefined): MockScenarioId {
  if (rawId === "empty" || rawId === "new-work" || rawId === "errors") {
    return rawId;
  }
  return "default";
}
