import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import type { LibraryTagIntentMutation } from "../../src/features/library/model/useLibraryQueries";
import { WorkTagEditor } from "../../src/features/library/ui/preview/WorkTagEditor";
import GlobalToast from "../../src/app/ui/GlobalToast";

function renderWithToast(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <GlobalToast
        onOpenScan={() => {}}
        onOpenScanNeedsAttention={() => {}}
        onRetrySkippedTrack={() => {}}
      />
    </QueryClientProvider>,
  );
}

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
    ...overrides,
  };
}

function makeTagMutation(
  overrides: Partial<LibraryTagIntentMutation> = {},
): LibraryTagIntentMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as LibraryTagIntentMutation;
}

vi.mock("../../src/entities/tag/useTagPrefixes", () => ({
  useTagPrefixes: () => ({ tagPrefixes: [] }),
}));

describe("WorkTagEditor", () => {
  it("タグ保存に失敗すると共通トースト（error variant・手動クローズ）で案内する", () => {
    renderWithToast(
      <WorkTagEditor
        work={makeWork()}
        tagSuggestions={[]}
        addTagMutation={makeTagMutation({ error: new Error("network") })}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );

    expect(screen.getByText("タグを保存できませんでした。")).toBeTruthy();
  });
});
