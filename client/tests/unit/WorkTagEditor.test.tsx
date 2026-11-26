import type { ReactElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import type { WorkTagMutation } from "../../src/entities/work/model/workMutations";
import { WorkTagEditor } from "../../src/features/library/ui/preview/WorkTagEditor";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { ApiRequestError } from "../../src/shared/api/http";
import { mockApi } from "../helpers/api";
import { buildSettings, buildWork } from "../helpers/builders";
import { getResizeObservers } from "./setup";

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
  return buildWork({
    id: "w1",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    tags: ["ASMR"],
    ...overrides,
  });
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

beforeEach(() => {
  mockApi({ "GET /api/settings": buildSettings(), "GET /api/tag-prefixes": [] });
});

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

    expect(screen.getByText("タグを保存できませんでした。")).toBeInTheDocument();
  });

  it("parse_error のあと role=alert を出し追加入力を無効にする", async () => {
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
    const button = screen.getByRole("button", { name: "タグを追加" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    const user = userEvent.setup();
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(button).toHaveFocus();
    expect(screen.queryByRole("combobox", { name: "追加するタグ" })).toBeNull();
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
    expect(screen.getByRole("button", { name: "タグを追加" })).toHaveAttribute("aria-disabled", "true");
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
    expect(screen.getByRole("button", { name: "タグを追加" })).not.toHaveAttribute("aria-disabled", "true");
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
    expect(screen.getByRole("button", { name: "タグを追加" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("ペイン幅が320pxをまたいでも開いている入力欄は閉じるまで切り替わらない", async () => {
    const user = userEvent.setup();
    renderWithToast(
      <div className="mle-prv__meta" data-testid="tag-pane">
        <WorkTagEditor
          work={makeWork()}
          tagSuggestions={[]}
          addTagMutation={makeTagMutation()}
          removeTagMutation={makeTagMutation()}
        />
      </div>,
    );
    const pane = screen.getByTestId("tag-pane");
    const measure = vi.spyOn(pane, "getBoundingClientRect");
    const observer = getResizeObservers().find((item) => item.getObserved().includes(pane))!;
    const resize = (width: number) => {
      const rect = new DOMRect(0, 0, width, 100);
      measure.mockReturnValue(rect);
      act(() => observer.flush([{ target: pane, contentRect: rect }]));
    };
    const trigger = () => screen.getByRole("button", { name: "タグを追加" });
    const input = () => screen.getByRole("combobox", { name: "追加するタグ" });

    resize(200);
    await user.click(trigger());
    const inline = input();
    expect(pane).toContainElement(inline);
    expect(inline).toHaveFocus();
    resize(400);
    expect(input()).toBe(inline);
    await user.keyboard("{Escape}");
    expect(inline).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    const floating = input();
    expect(pane).not.toContainElement(floating);
    await waitFor(() => expect(floating).toHaveFocus());
    resize(200);
    expect(input()).toBe(floating);
  });
});
