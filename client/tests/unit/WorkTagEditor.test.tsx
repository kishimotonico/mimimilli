import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WORK_SOURCE_PATCH_BLOCKED_MESSAGE } from "../../src/entities/work/sourceRevision";
import type { LibraryTagsPatchMutation } from "../../src/features/library/model/useLibraryQueries";
import { WorkTagEditor } from "../../src/features/library/ui/preview/WorkTagEditor";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: ["ASMR"],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
    sourceRevision: "revision-1",
    ...overrides,
  };
}

function makeTagsMutation(
  overrides: Partial<LibraryTagsPatchMutation> = {},
): LibraryTagsPatchMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as LibraryTagsPatchMutation;
}

vi.mock("../../src/entities/tag/useTagPrefixes", () => ({
  useTagPrefixes: () => ({ tagPrefixes: [] }),
}));

describe("WorkTagEditor", () => {
  it("sourceRevision未設定時はタグ追加を実行せず理由を表示する", () => {
    const mutateAsync = vi.fn();
    render(
      <WorkTagEditor
        work={makeWork({ sourceRevision: undefined })}
        tagSuggestions={[]}
        tagsMutation={makeTagsMutation({ mutateAsync })}
        expanded
      />,
    );

    const addButton = screen.getByRole("button", { name: "タグを追加" });
    expect(addButton).toBeDisabled();
    fireEvent.click(addButton);
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(WORK_SOURCE_PATCH_BLOCKED_MESSAGE);
  });
});
