import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import type { WorkTagMutation } from "../../src/entities/work/model/workMutations";
import { WorkTagEditor } from "../../src/features/library/ui/preview/WorkTagEditor";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { ApiRequestError } from "../../src/shared/api/http";

function renderWithToast(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={queryClient}>
      {node}
      <GlobalToast
        onOpenScan={() => {}}
        onOpenScanNeedsAttention={() => {}}
        onRetrySkippedTrack={() => {}}
      />
    </QueryClientProvider>
  );
  const view = render(wrap(ui));
  return {
    ...view,
    rerenderWithToast: (next: ReactElement) => view.rerender(wrap(next)),
  };
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

function makeTagMutation(overrides: Partial<WorkTagMutation> = {}): WorkTagMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as WorkTagMutation;
}

vi.mock("../../src/entities/tag/useTagPrefixes", () => ({
  useTagPrefixes: () => ({ tagPrefixes: [] }),
}));

const BROKEN_SOURCE_MESSAGE =
  "作品情報ファイルが壊れているため編集できません。表示は前回スキャン時点の内容です。";

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

  it("parse_error のあと role=alert を出し追加入力を disabled にする", () => {
    renderWithToast(
      <WorkTagEditor
        work={makeWork()}
        tagSuggestions={[]}
        addTagMutation={makeTagMutation({
          error: new ApiRequestError(502, "parse_error", BROKEN_SOURCE_MESSAGE),
        })}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(BROKEN_SOURCE_MESSAGE);
    expect(screen.getByRole("button", { name: "タグを追加" })).toBeDisabled();
    expect(screen.queryByText("タグを保存できませんでした。")).toBeNull();
  });

  it("conflict のあと role=alert を出し追加入力を disabled にする", () => {
    const message = "作品情報ファイルが見つからないため編集できません。";
    renderWithToast(
      <WorkTagEditor
        work={makeWork()}
        tagSuggestions={[]}
        addTagMutation={makeTagMutation()}
        removeTagMutation={makeTagMutation({
          error: new ApiRequestError(409, "conflict", message),
        })}
        expanded
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "タグを追加" })).toBeDisabled();
  });

  it("作品が切り替わると disabled を解除する", () => {
    const work = makeWork();
    const errorMutation = makeTagMutation({
      error: new ApiRequestError(502, "parse_error", BROKEN_SOURCE_MESSAGE),
    });
    const { rerenderWithToast } = renderWithToast(
      <WorkTagEditor
        work={work}
        tagSuggestions={[]}
        addTagMutation={errorMutation}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(BROKEN_SOURCE_MESSAGE);

    rerenderWithToast(
      <WorkTagEditor
        work={makeWork({ id: "w2" })}
        tagSuggestions={[]}
        addTagMutation={errorMutation}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "タグを追加" })).not.toBeDisabled();
  });

  it("閲覧 Work が再取得されると disabled を解除する", () => {
    const work = makeWork();
    const errorMutation = makeTagMutation({
      error: new ApiRequestError(502, "parse_error", BROKEN_SOURCE_MESSAGE),
    });
    const { rerenderWithToast } = renderWithToast(
      <WorkTagEditor
        work={work}
        tagSuggestions={[]}
        addTagMutation={errorMutation}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(BROKEN_SOURCE_MESSAGE);

    rerenderWithToast(
      <WorkTagEditor
        work={{ ...work, tags: [...work.tags] }}
        tagSuggestions={[]}
        addTagMutation={errorMutation}
        removeTagMutation={makeTagMutation()}
        expanded
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "タグを追加" })).not.toBeDisabled();
  });
});
