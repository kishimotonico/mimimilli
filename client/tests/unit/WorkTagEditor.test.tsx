import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WORK_SOURCE_PATCH_BLOCKED_MESSAGE } from "../../src/entities/work/sourceRevision";
import type { LibraryTagsPatchMutation } from "../../src/features/library/model/useLibraryQueries";
import { WorkTagEditor } from "../../src/features/library/ui/preview/WorkTagEditor";
import GlobalToast from "../../src/app/ui/GlobalToast";

// Toastは単一ホスト（GlobalToast）へ集約されているため、WorkTagEditorの表示要求を
// 目に見える形で検証するにはGlobalToastも一緒に描画する必要がある。
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

  it("タグ保存に失敗すると共通トースト（error variant・手動クローズ）で案内する", () => {
    renderWithToast(
      <WorkTagEditor
        work={makeWork()}
        tagSuggestions={[]}
        tagsMutation={makeTagsMutation({ error: new Error("network") })}
        expanded
      />,
    );

    expect(screen.getByText("タグを保存できませんでした。")).toBeTruthy();
  });
});
