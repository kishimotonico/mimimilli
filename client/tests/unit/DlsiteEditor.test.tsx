import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDlsiteState, type DlsitePreview, type Work } from "@mimimilli/shared";
import { DlsiteEditor } from "../../src/features/library/ui/preview/DlsiteEditor";
import { dlsiteInvalidateAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { dlsiteApplyToastAtom } from "../../src/entities/dlsite/model/dlsiteApplyToastAtom";

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

  render(<DlsiteEditor work={work} />, { wrapper });
  return store;
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
    applyDlsiteInfo.mockResolvedValue(undefined);

    const store = renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));
    await waitFor(() => expect(screen.getByText("DLsite情報の適用")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "選択内容を適用" }));

    await waitFor(() => expect(applyDlsiteInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("DLsite情報の適用")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(store.get(dlsiteApplyToastAtom)).toEqual({
        message: "DLsite情報を適用しました",
        variant: "success",
      }),
    );
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

    const store = renderEditor(work);
    fireEvent.click(screen.getByRole("button", { name: "取得結果を確認" }));

    await waitFor(() =>
      expect(store.get(dlsiteApplyToastAtom)).toEqual({
        message: "DLsiteの情報は現在の内容と同じでした",
        variant: "info",
      }),
    );
    expect(screen.queryByText("DLsite情報の適用")).not.toBeInTheDocument();
  });
});
