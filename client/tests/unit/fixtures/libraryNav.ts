import { vi } from "vitest";
import type { SmartFolderItem } from "@mimimilli/shared";
import { createInitialAppRoute } from "../../../src/entities/navigation/model/appRoute";
import type { LibraryRoute } from "../../../src/entities/navigation/model/appRoute";
import { resolveLibraryView } from "../../../src/entities/library/resolveLibraryView";
import type {
  LibraryViewActions,
  ReadyLibraryNavigation,
  ReadyLibraryViewState,
} from "../../../src/features/library/model/useLibraryNavigation";
import { defaultSmartFolderItems } from "../../helpers/smartFolders";

/** WorkGrid・WorkListPane等が受け取るnavのテスト用スタブ。デフォルトは「すべて」・未選択。 */
export function buildNav(
  overrides: Partial<ReadyLibraryViewState & LibraryViewActions> & {
    library?: Partial<LibraryRoute>;
    folders?: SmartFolderItem[];
  } = {},
): ReadyLibraryNavigation {
  const { library: libraryPatch, folders: foldersOverride, ...rest } = overrides;
  const folders = foldersOverride ?? defaultSmartFolderItems();
  const library: LibraryRoute = { ...createInitialAppRoute().library, ...libraryPatch };
  const view = resolveLibraryView(library, folders);
  return {
    foldersStatus: "ready",
    refetchFolders: vi.fn(),
    folders,
    view,
    searchQuery: view.kind === "works" ? view.q : "",
    selectedTags: view.kind === "works" ? view.selectedTags : [],
    selectedWorkId: library.selectedWorkId,
    isPending: false,
    openFolder: vi.fn(),
    openGroupValue: vi.fn(),
    selectGroupValue: vi.fn(),
    removeTag: vi.fn(),
    addTag: vi.fn(),
    clickTag: vi.fn(),
    clearTags: vi.fn(),
    searchInAll: vi.fn(),
    setSearchQuery: vi.fn(),
    selectWork: vi.fn(),
    setSort: vi.fn(),
    goToSegment: vi.fn(),
    ...rest,
  };
}
