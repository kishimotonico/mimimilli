import { vi } from "vitest";
import type {
  LibraryViewActions,
  LibraryViewState,
} from "../../../src/features/library/model/useLibraryNavigation";

/** WorkGrid・WorkListPane等が受け取るnavのテスト用スタブ。デフォルトは軸=all・未選択。 */
export function buildNav(
  overrides: Partial<LibraryViewState & LibraryViewActions> = {},
): LibraryViewState & LibraryViewActions {
  return {
    activeAxis: "all",
    selectedTags: [],
    selectedWorkId: null,
    sort: "added-desc",
    setAxis: vi.fn(),
    toggleTag: vi.fn(),
    replaceTag: vi.fn(),
    addTag: vi.fn(),
    clearTags: vi.fn(),
    selectWork: vi.fn(),
    setSort: vi.fn(),
    goToSegment: vi.fn(),
    isPending: false,
    ...overrides,
  };
}
