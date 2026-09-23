import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work, WorkEditSnapshot } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import type { LibraryWorkEditMutation } from "../../src/features/library/model/useLibraryQueries";
import { useLibraryWorkPatchMutations } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { WorkEditDialog } from "../../src/features/library/ui/preview/WorkEditDialog";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { ApiRequestError } from "../../src/shared/api/http";

const { mockGetWorkEditSnapshot, mockProjectWorkSource, mockPatchWorkSource } = vi.hoisted(() => ({
  mockGetWorkEditSnapshot: vi.fn(),
  mockProjectWorkSource: vi.fn(),
  mockPatchWorkSource: vi.fn(),
}));
vi.mock("../../src/entities/work/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/entities/work/api")>()),
  getWorkEditSnapshot: (...args: unknown[]) => mockGetWorkEditSnapshot(...args),
  projectWorkSource: (...args: unknown[]) => mockProjectWorkSource(...args),
  patchWorkSource: (...args: unknown[]) => mockPatchWorkSource(...args),
}));
vi.mock("../../src/entities/tag/useTagPrefixes", () => ({
  useTagPrefixes: () => ({ tagPrefixes: [{ prefix: "cv", protected: true }] }),
}));
vi.mock("../../src/features/library/ui/preview/DlsiteEditor", () => ({
  DlsiteEditor: () => null,
}));

// Toastは単一ホスト（GlobalToast）へ集約されているため、WorkEditDialogの表示要求を
// 目に見える形で検証するにはGlobalToastも一緒に描画する必要がある。
function withToast(queryClient: QueryClient, ui: ReactElement) {
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

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  mockGetWorkEditSnapshot.mockReset();
  mockGetWorkEditSnapshot.mockResolvedValue(makeSnapshot());
  mockProjectWorkSource.mockReset();
  mockPatchWorkSource.mockReset();
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

function renderDialog(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(withToast(queryClient, ui));
  return {
    ...view,
    queryClient,
    rerender: (next: ReactElement) => view.rerender(withToast(queryClient, next)),
  };
}

function makeEditMutation(
  overrides: Partial<LibraryWorkEditMutation> = {},
): LibraryWorkEditMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ snapshot: makeSnapshot() }),
    ...overrides,
  } as LibraryWorkEditMutation;
}

/** 編集snapshotの初回読み込みが完了する（タイトル欄が有効になる）のを待つ。
 *  findByLabelTextはタイトル欄がdisabledのまま最初のレンダーで既に存在するため
 *  代わりにならない。 */
async function waitForReady() {
  await waitFor(() => expect(screen.getByLabelText("タイトル")).not.toBeDisabled());
}

function renderEditDialog(
  options: {
    work?: Work;
    onClose?: () => void;
    editMutation?: LibraryWorkEditMutation;
    tagSuggestions?: string[];
  } = {},
) {
  const work = options.work ?? makeWork();
  const onClose = options.onClose ?? vi.fn();
  const editMutation = options.editMutation ?? makeEditMutation();
  if (options.work) mockGetWorkEditSnapshot.mockResolvedValue(makeSnapshot(work));
  const view = renderDialog(
    <WorkEditDialog
      work={work}
      tagSuggestions={options.tagSuggestions ?? []}
      workPatchMutations={{ editMutation }}
      onClose={onClose}
    />,
  );
  return { ...view, work, onClose, editMutation };
}

/** editMutation自体をモックせず、useLibraryWorkPatchMutationsが返す実物を渡す。
 *  保存成功時のonSuccess（setQueryData）とダイアログのcommitSavedSnapshotの
 *  実行順に依存しないことを確認するためのラッパー。 */
function EditDialogWithRealMutation(props: {
  work: Work;
  tagSuggestions?: string[];
  onClose?: () => void;
}) {
  const nav: LibraryViewState = {
    activeAxis: "all",
    selectedTags: [],
    selectedWorkId: props.work.id,
    sort: "added-desc",
  };
  const { editMutation } = useLibraryWorkPatchMutations(nav, "");
  return (
    <WorkEditDialog
      work={props.work}
      tagSuggestions={props.tagSuggestions ?? []}
      workPatchMutations={{ editMutation }}
      onClose={props.onClose ?? vi.fn()}
    />
  );
}

describe("WorkEditDialog", () => {
  it("正本が読めないときは入力を無効化し理由を表示する", async () => {
    mockGetWorkEditSnapshot.mockRejectedValue(
      new ApiRequestError(502, "parse_error", "作品の正本が壊れているため編集できません。"),
    );
    const { onClose } = renderEditDialog({ onClose: vi.fn() });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "作品の正本が壊れているため編集できません。",
      ),
    );
    expect(screen.getByLabelText("タイトル")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("javascript: のURLは保存せずバリデーション文言を出す", async () => {
    const editMutation = makeEditMutation();
    renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.click(screen.getByRole("button", { name: "URLを追加" }));
    fireEvent.change(screen.getByLabelText("URLラベル 1"), { target: { value: "公式" } });
    fireEvent.change(screen.getByLabelText("URL 1"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(editMutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("httpまたはhttpsのURLだけを登録できます");
  });

  it("一括保存: dirtyなフィールドだけを1回のPATCHへまとめて送る", async () => {
    const editMutation = makeEditMutation();
    renderEditDialog({ editMutation });
    await waitForReady();

    // タイトルとURLをdirty化する（タグは変更しない）
    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "新しいタイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "URLを追加" }));
    fireEvent.change(screen.getByLabelText("URLラベル 1"), { target: { value: "公式" } });
    fireEvent.change(screen.getByLabelText("URL 1"), {
      target: { value: "https://example.com/work" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = editMutation.mutateAsync.mock.calls[0]?.[0];
    expect(payload).toEqual({
      workId: "w1",
      sourceRevision: "revision-1",
      title: "新しいタイトル",
      tags: undefined,
      urls: [{ label: "公式", url: "https://example.com/work" }],
    });
  });

  it("タグだけをdraftで追加・削除しても保存ボタンを押すまでサーバーへ通信しない", async () => {
    const editMutation = makeEditMutation();
    renderEditDialog({
      work: makeWork({ tags: ["ASMR"] }),
      editMutation,
      tagSuggestions: ["ASMR", "癒し系"],
    });
    await waitForReady();

    fireEvent.click(screen.getByRole("button", { name: "タグを追加" }));
    fireEvent.change(screen.getByRole("combobox", { name: "追加するタグ" }), {
      target: { value: "癒し系" },
    });
    fireEvent.click(screen.getByRole("option", { name: /癒し系/ }));

    expect(screen.getByText("癒し系")).toBeTruthy();
    expect(editMutation.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(editMutation.mutateAsync.mock.calls[0]?.[0]).toEqual({
      workId: "w1",
      sourceRevision: "revision-1",
      title: undefined,
      tags: ["ASMR", "癒し系"],
      urls: undefined,
    });
  });

  it("保護タグの削除はdraft上で確認を挟み、通信なしで元に戻せる", async () => {
    const editMutation = makeEditMutation();
    renderEditDialog({ work: makeWork({ tags: ["cv/藤田茜"] }), editMutation });
    await waitForReady();

    fireEvent.click(screen.getByRole("button", { name: /を削除$/ }));
    expect(screen.getByRole("alertdialog", { name: "保護タグの削除" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.queryByText("藤田茜")).toBeNull();
    expect(editMutation.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(screen.getByText("藤田茜")).toBeTruthy();
    expect(editMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("保護タグ削除後に保存すると、undo導線は送信開始と同時に無効化され再表示されない", async () => {
    const editMutation = makeEditMutation();
    renderEditDialog({ work: makeWork({ tags: ["cv/藤田茜"] }), editMutation });
    await waitForReady();

    fireEvent.click(screen.getByRole("button", { name: /を削除$/ }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.getByRole("button", { name: "元に戻す" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // 退出アニメーション中はAnimatePresenceがDOMを一瞬保持しうるが（Toast.test.tsx参照）、
    // 送信開始と同時にundo導線は無効化され、最終的に表示から消える。
    await waitFor(() => expect(screen.queryByRole("button", { name: "元に戻す" })).toBeNull());

    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(editMutation.mutateAsync.mock.calls[0]?.[0]).toEqual({
      workId: "w1",
      sourceRevision: "revision-1",
      title: undefined,
      tags: [],
      urls: undefined,
    });
    // 保存完了後もundo導線は出てこない
    expect(screen.queryByRole("button", { name: "元に戻す" })).toBeNull();
  });

  it("未編集ならEscapeで確認なく即座に閉じる", async () => {
    const { onClose, container } = renderEditDialog();
    await waitForReady();

    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("未保存の変更があるときEscapeで即座に閉じず、保存/破棄/取消のプロンプトを出す", async () => {
    const { onClose, container } = renderEditDialog();
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "編集途中のタイトル" },
    });
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();
  });

  it("プロンプトの破棄するで入力を捨てて閉じる", async () => {
    const { onClose } = renderEditDialog();
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "破棄する" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("プロンプトの取消は何もせず編集ダイアログへ戻る", async () => {
    const { onClose } = renderEditDialog();
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");
  });

  it("プロンプトの保存するは一括保存してから閉じる", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockResolvedValue({
        snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
        projection: { status: "published" },
      }),
    });
    const { onClose } = renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editMutation.mutateAsync).toHaveBeenCalledWith({
      workId: "w1",
      sourceRevision: "revision-1",
      title: "編集途中",
      tags: undefined,
      urls: undefined,
    });
  });

  it("保存処理中はキャンセルを押せない（後から成功した保存が続けていた編集ごと閉じる事故を防ぐ）", async () => {
    let resolveMutate:
      | ((result: { snapshot: WorkEditSnapshot; projection: { status: "published" } }) => void)
      | undefined;
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveMutate = resolve;
          }),
      ),
    });
    const { onClose } = renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    // isPendingはmutateAsyncのpromise解決状態と直結していないモックのため、
    // ここではmutateAsyncが呼ばれたことを確認してから解決する（isPendingは実運用ではreact-queryが管理）
    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));

    resolveMutate?.({
      snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
      projection: { status: "published" },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("保存に失敗した場合は閉じずエラーを表示し、入力値を保持する", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockRejectedValue(new Error("network")),
    });
    const { onClose } = renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    // mutateAsyncの呼び出し回数ではなく、reject→catch→setStateが完了した後の
    // UIの最終状態そのものをwaitForの条件にする。
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");
    await waitFor(() => expect(screen.getByText("保存できませんでした。")).toBeTruthy());
  });

  it("保存に失敗するとタイトル欄へフォーカスが戻る", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockRejectedValue(new Error("network")),
    });
    renderEditDialog({ editMutation });
    await waitForReady();

    const input = screen.getByLabelText("タイトル");
    fireEvent.change(input, { target: { value: "編集途中" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("409 source_changedを受けたときdraftは消えず、最新を確認中の文言が出る", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("changed"), { code: "source_changed" })),
    });
    // ApiRequestError のインスタンスとして扱えるよう、実クラスを使う
    const { ApiRequestError } = await import("../../src/shared/api/http");
    editMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiRequestError("changed", "source_changed", 409));
    renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText(/作品データが他で更新されました/)).toBeTruthy());
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");
  });

  it("背景で非dirtyなフィールドが変わったら追従し、dirtyなフィールドは維持する", async () => {
    const { queryClient, work } = renderEditDialog({ work: makeWork({ title: "元タイトル" }) });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集中タイトル" } });

    // DlsiteEditorの独立適用等、背景でtagsだけが変わったことをsetQueryDataで模す
    queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), {
      ...makeSnapshot(work, "revision-2"),
      title: "元タイトル",
      tags: ["新タグ"],
    });

    await waitFor(() => expect(screen.getByText("新タグ")).toBeTruthy());
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集中タイトル");
  });

  it("dirtyなフィールドが背景で変わったら衝突通知を出し、「最新の値を使う」で解消する", async () => {
    const { queryClient, work } = renderEditDialog({ work: makeWork({ title: "元タイトル" }) });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "自分の編集" } });

    queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), {
      ...makeSnapshot(work, "revision-2"),
      title: "他人が変更したタイトル",
    });

    await waitFor(() =>
      expect(screen.getByText("保存後に別の変更がありました（タイトル）")).toBeTruthy(),
    );
    expect(screen.getByLabelText("タイトル")).toHaveValue("自分の編集"); // draftは維持

    fireEvent.click(screen.getByRole("button", { name: "最新の値を使う" }));
    expect(screen.getByLabelText("タイトル")).toHaveValue("他人が変更したタイトル");
    expect(screen.queryByText("保存後に別の変更がありました（タイトル）")).toBeNull();
  });

  it("衝突を「自分の編集で上書きする」で解消すると、draftは維持したまま再保存できる", async () => {
    const editMutation = makeEditMutation();
    const { queryClient, work } = renderEditDialog({
      work: makeWork({ title: "元タイトル" }),
      editMutation,
    });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "自分の編集" } });

    queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), {
      ...makeSnapshot(work, "revision-2"),
      title: "他人が変更したタイトル",
    });
    await waitFor(() =>
      expect(screen.getByText("保存後に別の変更がありました（タイトル）")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "自分の編集で上書きする" }));
    expect(screen.getByLabelText("タイトル")).toHaveValue("自分の編集"); // draftは維持
    expect(screen.queryByText("保存後に別の変更がありました（タイトル）")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(editMutation.mutateAsync.mock.calls[0]?.[0]).toEqual({
      workId: "w1",
      sourceRevision: "revision-2", // 基準revisionは最新へ進んでいる
      title: "自分の編集",
      tags: undefined,
      urls: undefined,
    });
  });

  it("保存応答のprojectionがpendingでも保存成功として扱い、dirtyを解除し閉じても未保存プロンプトへ戻さず再送しない", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockResolvedValue({
        snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
        projection: { status: "pending", reason: "source_changed" },
      }),
    });
    const { onClose } = renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    // projectionがpendingでもsource確定は成功として扱われ、draftは基準へ一致してdirtyが解ける
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeDisabled());
    await waitFor(() =>
      expect(
        screen.getByText(
          "作品ファイルは保存しました。反映の直前にファイルが変わったため、一覧はまだ古いです。",
        ),
      ).toBeTruthy(),
    );

    // dirtyが解除されているため、閉じる操作は未保存プロンプトへ戻さず即座に閉じる
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]!);
    expect(screen.queryByRole("alertdialog", { name: "未保存の変更があります" })).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    // 閉じる操作だけではdraftの再送は起きない
    expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("保存後に再編集してdirtyな状態で一覧へ反映すると、再投影の応答でdraftが上書きされない", async () => {
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockResolvedValue({
        snapshot: makeSnapshot(makeWork({ title: "編集途中" }), "revision-2"),
        projection: { status: "pending", reason: "source_changed" },
      }),
    });
    const { queryClient } = renderEditDialog({ editMutation });
    await waitForReady();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/lib",
      lastScanTime: null,
      lastScanRootFolder: null,
    });

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(editMutation.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "一覧へ反映する" })).toBeTruthy(),
    );

    // 保存が完了して基準へ追従した後、さらに編集してdirtyにする
    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "再編集した内容" } });

    // 再投影の応答は「今の正本」であり、外部変更で別のタイトルになっているとする
    mockProjectWorkSource.mockResolvedValue({
      snapshot: makeSnapshot(makeWork({ title: "外部で変わったタイトル" }), "revision-3"),
      projection: { status: "published" },
    });
    fireEvent.click(screen.getByRole("button", { name: "一覧へ反映する" }));

    // 再投影後もdirtyなdraftはbackground refetchと同じ衝突判定に乗り、無条件で上書きされない
    await waitFor(() =>
      expect(screen.getByText("保存後に別の変更がありました（タイトル）")).toBeTruthy(),
    );
    expect(screen.getByLabelText("タイトル")).toHaveValue("再編集した内容");
  });

  it("通信断（ApiTransportError）では成功とも失敗とも推測せず、draftを保持したまま結果不明の文言を出す", async () => {
    const { ApiTransportError } = await import("../../src/shared/api/http");
    const editMutation = makeEditMutation({
      mutateAsync: vi.fn().mockRejectedValue(new ApiTransportError("unreachable")),
    });
    renderEditDialog({ editMutation });
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(
        screen.getByText("保存の結果を確認できませんでした。作品情報を読み直してください。"),
      ).toBeTruthy(),
    );
    // draftは保持される（成功とも失敗とも推測しない）
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");
    // 保存ボタンはまだdirtyなので有効なまま（自動再送はしない。ユーザーの再操作に任せる）
    expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled();
  });

  it("実際のeditMutation経由で保存しても、自分の保存応答が外部変更として衝突通知にならない", async () => {
    const work = makeWork({ title: "元タイトル" });
    mockGetWorkEditSnapshot.mockResolvedValue(makeSnapshot(work, "revision-1"));
    mockPatchWorkSource.mockResolvedValue({
      snapshot: makeSnapshot(makeWork({ title: "編集後タイトル" }), "revision-2"),
      projection: { status: "published" },
    });
    renderDialog(<EditDialogWithRealMutation work={work} />);
    await waitForReady();

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集後タイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mockPatchWorkSource).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeDisabled());
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集後タイトル");
    expect(screen.queryByText(/保存後に別の変更がありました/)).toBeNull();
  });
});
