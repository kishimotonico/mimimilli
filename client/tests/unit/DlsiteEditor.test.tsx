import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyDlsiteState,
  toDlsiteLinkageStatus,
  type DlsitePreview,
  type Work,
  type WorkEditSnapshot,
} from "@mimimilli/shared";
import { DlsiteEditor } from "../../src/features/library/ui/preview/DlsiteEditor";
import { dlsiteInvalidateAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import GlobalToast from "../../src/app/ui/GlobalToast";

const fetchDlsiteInfo = vi.fn();
const applyDlsiteInfo = vi.fn();
const updateDlsiteState = vi.fn();

vi.mock("../../src/entities/work/api", () => ({
  fetchDlsiteInfo: (...args: unknown[]) => fetchDlsiteInfo(...args),
  applyDlsiteInfo: (...args: unknown[]) => applyDlsiteInfo(...args),
  updateDlsiteState: (...args: unknown[]) => updateDlsiteState(...args),
}));

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "work-1",
    title: "現在タイトル",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/work-1",
    totalDurationSec: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: ["サークル/夜想曲"],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: { ...emptyDlsiteState(), rjCode: "RJ501001" },
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
    ...overrides,
  };
}

function makeSnapshot(work: Work): WorkEditSnapshot {
  return {
    sourceRevision: "rev-1",
    id: work.id,
    physicalPath: work.physicalPath,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
    coverImage: work.coverImage,
    dlsite: {
      rjCode: work.dlsite.rjCode,
      status: toDlsiteLinkageStatus(work.dlsite.status),
      appliedTags: work.dlsite.appliedTags,
    },
  };
}

function renderEditor(work: Work) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteInvalidateAtom, { run: vi.fn(async () => {}) });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );

  const view = render(
    <>
      <DlsiteEditor workId={work.id} snapshot={makeSnapshot(work)} />
      <GlobalToast />
    </>,
    { wrapper },
  );
  return {
    store,
    rerender(next: Work) {
      view.rerender(
        <>
          <DlsiteEditor workId={next.id} snapshot={makeSnapshot(next)} />
          <GlobalToast />
        </>,
      );
    },
  };
}

describe("DlsiteEditor", () => {
  beforeEach(() => {
    fetchDlsiteInfo.mockReset();
    applyDlsiteInfo.mockReset();
    updateDlsiteState.mockReset();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
  });

  it("成功: 差分ありの適用でダイアログが閉じ、内部エラーを出さず成功トーストを出す", async () => {
    const work = makeWork();
    const preview: DlsitePreview = {
      info: {
        rjCode: "RJ501001",
        title: "取得タイトル",
        circle: "夜想曲",
        cvs: [],
        genreTags: [],
        ageRating: null,
        coverUrl: "https://example.test/cover.jpg",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
      },
      sourceRevision: "rev-1",
    };
    fetchDlsiteInfo.mockResolvedValue(preview);
    applyDlsiteInfo.mockResolvedValue({
      snapshot: makeSnapshot(makeWork({ title: "取得タイトル" })),
      projection: { status: "published" },
    });

    renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));
    await waitFor(() => expect(screen.getByText("DLsite情報の適用")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "選択内容を適用" }));

    await waitFor(() => expect(applyDlsiteInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("DLsite情報の適用")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("DLsite情報を適用しました")).toBeInTheDocument());
  });

  it("失敗: 適用が例外を投げても生のエラーメッセージを画面に出さない", async () => {
    const work = makeWork();
    const preview: DlsitePreview = {
      info: {
        rjCode: "RJ501001",
        title: "取得タイトル",
        circle: "夜想曲",
        cvs: [],
        genreTags: [],
        ageRating: null,
        coverUrl: "https://example.test/cover.jpg",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
      },
      sourceRevision: "rev-1",
    };
    fetchDlsiteInfo.mockResolvedValue(preview);
    applyDlsiteInfo.mockRejectedValue(new TypeError("invalidate.run is not a function"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));
    await waitFor(() => expect(screen.getByText("DLsite情報の適用")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "選択内容を適用" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("DLsite情報を適用できませんでした"),
    );
    expect(screen.queryByText(/is not a function/)).not.toBeInTheDocument();
  });

  it("画像なし: カバー行が適用不可として理由付きで無効表示される", async () => {
    const work = makeWork();
    const preview: DlsitePreview = {
      info: {
        rjCode: "RJ501001",
        title: work.title,
        circle: "夜想曲",
        cvs: ["新CV"],
        genreTags: [],
        ageRating: null,
        coverUrl: null,
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
      },
      sourceRevision: "rev-1",
    };
    fetchDlsiteInfo.mockResolvedValue(preview);

    renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));
    await waitFor(() => expect(screen.getByText("DLsite情報の適用")).toBeInTheDocument());

    expect(screen.getByText("対象外").closest("label")).toHaveAttribute(
      "title",
      "DLsiteに画像がありません",
    );
    expect(screen.getByText("同一")).toBeInTheDocument();
  });

  it("差分0件: 確認ダイアログを開かず結果をトーストで通知する", async () => {
    const work = makeWork({
      title: "同一タイトル",
      urls: [
        {
          label: "DLsite",
          url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
        },
      ],
    });
    const preview: DlsitePreview = {
      info: {
        rjCode: "RJ501001",
        title: "同一タイトル",
        circle: "夜想曲",
        cvs: [],
        genreTags: [],
        ageRating: null,
        coverUrl: null,
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
      },
      sourceRevision: "rev-1",
    };
    fetchDlsiteInfo.mockResolvedValue(preview);

    renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));

    await waitFor(() =>
      expect(screen.getByText("DLsiteの情報は現在の内容と同じでした")).toBeInTheDocument(),
    );
    expect(screen.queryByText("DLsite情報の適用")).not.toBeInTheDocument();
  });

  it("rjCodeがnullのときフォルダー名から検出した値を初期表示する", () => {
    renderEditor(
      makeWork({
        physicalPath: "/lib/RJ900001_作品",
        title: "作品",
        dlsite: emptyDlsiteState(),
      }),
    );
    expect(screen.getByLabelText("DLsite RJ/VJコード")).toHaveValue("RJ900001");
  });

  it("明示の空RJコードではフォルダー名から検出しない", () => {
    renderEditor(
      makeWork({
        physicalPath: "/lib/RJ900001_作品",
        dlsite: { ...emptyDlsiteState(), rjCode: "" },
      }),
    );
    expect(screen.getByLabelText("DLsite RJ/VJコード")).toHaveValue("");
  });

  it("タイトル保存でwork参照が変わっても入力中のRJコードは残る", () => {
    const work = makeWork({
      physicalPath: "/lib/RJ900001_作品",
      title: "作品",
      dlsite: emptyDlsiteState(),
    });
    const { rerender } = renderEditor(work);
    const input = screen.getByLabelText("DLsite RJ/VJコード");
    expect(input).toHaveValue("RJ900001");
    fireEvent.change(input, { target: { value: "RJ111111" } });
    expect(input).toHaveValue("RJ111111");
    rerender({ ...work, title: "保存したタイトル" });
    expect(screen.getByLabelText("DLsite RJ/VJコード")).toHaveValue("RJ111111");
  });
});
