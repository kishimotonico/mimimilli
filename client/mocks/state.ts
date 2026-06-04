import {
  type SearchPresetMock,
  type SmartFolderMock,
  type WorkSummaryMock,
} from "./fixtures/index";
import { createMockScenario, type MockScenarioId } from "./scenarios";

export interface MockState {
  scenarioId: MockScenarioId;
  works: WorkSummaryMock[];
  presets: SearchPresetMock[];
  smartFolders: SmartFolderMock[];
  rootFolder: string | null;
  lastScanTime: string;
  scanNewWorkIds: string[];
  nextPresetId: number;
  nextSmartFolderId: number;
}

export function createMockState(): MockState {
  const now = new Date().toISOString();
  const scenario = createMockScenario(process.env.MIMIKAGO_MOCK_SCENARIO, now);
  return {
    scenarioId: scenario.id,
    works: scenario.works,
    presets: scenario.presets,
    smartFolders: scenario.smartFolders,
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    scanNewWorkIds: scenario.scanNewWorkIds,
    nextPresetId: 4,
    nextSmartFolderId: 3,
  };
}
