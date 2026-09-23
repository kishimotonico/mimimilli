import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work, WorkEditSnapshot } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import type {
  LibraryTitlePatchMutation,
  LibraryUrlsPatchMutation,
} from "../../src/features/library/model/useLibraryQueries";
import { WorkEditDialog } from "../../src/features/library/ui/preview/WorkEditDialog";
import GlobalToast from "../../src/app/ui/GlobalToast";

const { mockGetWorkEditSnapshot } = vi.hoisted(() => ({
  mockGetWorkEditSnapshot: vi.fn(),
}));
vi.mock("../../src/entities/work/api", () => ({
  getWorkEditSnapshot: (...args: unknown[]) => mockGetWorkEditSnapshot(...args),
}));

// Toastは単一ホスト（GlobalToast）へ集約されているため、WorkEditDialogの表示要求を
// 目に見える形で検証するにはGlobalToastも一緒に描画する必要がある。
function withToast(queryClient: QueryClient, ui: ReactElement) {
  seedSource(queryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {ui}
      <GlobalToast
        onOpenScan={() => {}}
        onOpenScanNeedsAttention={() => {}}
        onRetrySkippedTrack={() => {}}
      />
    </QueryClientProvider>
  );
}

function renderWithToast(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(withToast(queryClient, ui));
  return {
    ...view,
    rerenderWithToast: (nextUi: ReactElement) => view.rerender(withToast(queryClient, nextUi)),
  };
}

vi.mock("../../src/features/library/ui/preview/WorkTagEditor", () => ({
  WorkTagEditor: () => <div data-testid="tag-editor" />,
}));
vi.mock("../../src/features/library/ui/preview/DlsiteEditor", () => ({
  DlsiteEditor: () => null,
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  mockGetWorkEditSnapshot.mockReset();
  mockGetWorkEditSnapshot.mockResolvedValue(makeSnapshot());
});

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
    tags: [],
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

function makeSnapshot(work: Work = makeWork(), revision = "revision-1"): WorkEditSnapshot {
  return {
    sourceRevision: revision,
    id: work.id,
    physicalPath: work.physicalPath,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
    coverImage: work.coverImage,
    dlsite: work.dlsite,
  };
}

function seedSource(queryClient: QueryClient, work: Work = makeWork()) {
  queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), makeSnapshot(work));
}

function renderDialog(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  seedSource(queryClient);
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
  );
  const view = render(wrap(ui));
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(wrap(next)),
  };
}

function tagMutations() {
  return {
    addTagMutation: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as never,
    removeTagMutation: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as never,
  };
}

function makeTitleMutation(
  overrides: Partial<LibraryTitlePatchMutation> = {},
): LibraryTitlePatchMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as LibraryTitlePatchMutation;
}

function makeUrlsMutation(
  overrides: Partial<LibraryUrlsPatchMutation> = {},
): LibraryUrlsPatchMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as LibraryUrlsPatchMutation;
}

describe("WorkEditDialog", () => {
  it("正本が読めないときはタイトル保存を実行せず理由を表示する", async () => {
    const mutate = vi.fn();
    mockGetWorkEditSnapshot.mockRejectedValue(
      new Error("作品の正本が壊れているため編集できません。"),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkEditDialog
          work={makeWork()}
          tagSuggestions={[]}
          workPatchMutations={{
            titleMutation: makeTitleMutation({ mutate }),
            ...tagMutations(),
            urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
          }}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "作品の正本が壊れているため編集できません。",
      ),
    );
    const input = screen.getByLabelText("タイトル");
    expect(input).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "タイトルを保存" }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("javascript: のURLは保存せずバリデーション文言を出す", () => {
    const mutate = vi.fn();
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate, isPending: false, error: null } as never,
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "URLを追加" }));
    fireEvent.change(screen.getByLabelText("URLラベル 1"), { target: { value: "公式" } });
    fireEvent.change(screen.getByLabelText("URL 1"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "関連URLを保存" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("httpまたはhttpsのURLだけを登録できます");
  });

  it("http(s)のURLを保存できる", () => {
    const mutate = vi.fn();
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate, isPending: false, error: null } as never,
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "URLを追加" }));
    fireEvent.change(screen.getByLabelText("URLラベル 1"), { target: { value: "公式" } });
    fireEvent.change(screen.getByLabelText("URL 1"), {
      target: { value: "https://example.com/work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "関連URLを保存" }));

    expect(mutate).toHaveBeenCalledWith({
      workId: "w1",
      sourceRevision: "revision-1",
      urls: [{ label: "公式", url: "https://example.com/work" }],
    });
  });

  it("未編集ならEscapeで確認なく即座に閉じる", () => {
    const onClose = vi.fn();
    const { container } = renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("未保存の変更があるときEscapeで即座に閉じず、保存/破棄/取消のプロンプトを出す", () => {
    const onClose = vi.fn();
    const { container } = renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "編集途中のタイトル" },
    });
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();
  });

  it("×ボタン・フッターの閉じるボタンも未保存時は同じプロンプトへ合流する", () => {
    const onClose = vi.fn();
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    const [xButton, footerButton] = screen.getAllByRole("button", { name: "閉じる" });
    if (!xButton || !footerButton) throw new Error("close buttons not found");

    fireEvent.click(xButton);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    fireEvent.click(footerButton);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();
  });

  it("プロンプトの破棄するで入力を捨てて閉じる", () => {
    const onClose = vi.fn();
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "破棄する" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("プロンプトの取消は何もせず編集ダイアログへ戻る", () => {
    const onClose = vi.fn();
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");
  });

  it("プロンプトの保存するはタイトルを保存してから閉じる", async () => {
    const onClose = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
      projection: { status: "published" },
    });
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ mutateAsync }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      workId: "w1",
      title: "編集途中",
      sourceRevision: "revision-1",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("保存処理中はキャンセルを押せない（後から成功した保存が続けていた編集ごと閉じる事故を防ぐ）", async () => {
    const onClose = vi.fn();
    let resolveMutate:
      | ((result: { snapshot: WorkEditSnapshot; projection: { status: "published" } }) => void)
      | undefined;
    const mutateAsync = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveMutate = resolve;
        }),
    );
    renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ mutateAsync }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    // 保存が進行中の間、キャンセルは無効化される
    await waitFor(() => expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();

    resolveMutate?.({
      snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
      projection: { status: "published" },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("保存に失敗した場合は閉じずエラートーストを表示し、入力値を保持する", async () => {
    const onClose = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network"));
    const { rerenderWithToast } = renderWithToast(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ mutateAsync }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull(); // プロンプトは閉じ、編集ダイアログ側にエラーを出す
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中"); // 入力値は保持される

    // 呼び出し側（react-queryのuseMutation実体）がerrorを反映した状態を模して再描画する
    rerenderWithToast(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ mutateAsync, error: new Error("network") }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("タイトルを保存できませんでした。")).toBeTruthy();
  });

  it("保存中disabledでフォーカスが外れても、失敗後にタイトル欄へ戻す", () => {
    const onClose = vi.fn();
    const { rerender } = renderDialog(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );

    const input = screen.getByLabelText("タイトル");
    fireEvent.change(input, { target: { value: "編集途中" } });
    input.focus();
    expect(document.activeElement).toBe(input);

    // 保存中はdisabledになり、実ブラウザはフォーカスを外す。jsdom/happy-domはdisabled化で
    // 自動blurしないため、フォーカスが失われた状態を別要素へのフォーカス移動で模擬する。
    rerender(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ isPending: true }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );
    screen.getByRole("button", { name: "URLを追加" }).focus();
    expect(document.activeElement).not.toBe(input);

    // 保存に失敗するとフォーカスがタイトル欄へ戻る
    rerender(
      <WorkEditDialog
        work={makeWork()}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation({ isPending: false, error: new Error("network") }),
          ...tagMutations(),
          urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
        }}
        onClose={onClose}
      />,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("タイトル"));
  });

  it("URL保存も、保存中disabledでフォーカスが外れたら失敗後に先頭のURL欄へ戻す", () => {
    const onClose = vi.fn();
    // work は同一参照を使い回す（毎回 makeWork() すると urls: [] が新しい参照になり、
    // work.urls 依存の同期effectがdraftを巻き戻してしまう）
    const work = makeWork();
    const { rerenderWithToast } = renderWithToast(
      <WorkEditDialog
        work={work}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: makeUrlsMutation(),
        }}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "URLを追加" }));
    const labelInput = screen.getByLabelText("URLラベル 1");
    fireEvent.change(labelInput, { target: { value: "公式" } });
    fireEvent.change(screen.getByLabelText("URL 1"), {
      target: { value: "https://example.com" },
    });
    labelInput.focus();
    expect(document.activeElement).toBe(labelInput);

    // 保存中はdisabledになり、実ブラウザはフォーカスを外す（title側のテストと同様に模擬する）
    rerenderWithToast(
      <WorkEditDialog
        work={work}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: makeUrlsMutation({ isPending: true }),
        }}
        onClose={onClose}
      />,
    );
    screen.getAllByRole("button", { name: "閉じる" })[0]?.focus();
    expect(document.activeElement).not.toBe(screen.getByLabelText("URLラベル 1"));

    // 保存に失敗すると先頭のURLラベル欄へフォーカスが戻る
    rerenderWithToast(
      <WorkEditDialog
        work={work}
        tagSuggestions={[]}
        workPatchMutations={{
          titleMutation: makeTitleMutation(),
          ...tagMutations(),
          urlsMutation: makeUrlsMutation({ isPending: false, error: new Error("network") }),
        }}
        onClose={onClose}
      />,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("URLラベル 1"));
    expect(screen.getByLabelText("URLラベル 1")).toHaveValue("公式"); // 入力値は保持される
    expect(screen.getByText("関連URLを保存できませんでした。")).toBeTruthy();
  });
});
