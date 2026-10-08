import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import { DlsiteEditor } from "../../src/features/library/ui/preview/DlsiteEditor";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { mockApi } from "../helpers/api";
import {
  buildDlsitePreview,
  buildSettings,
  buildWork,
  buildWorkEditSnapshotOf,
  buildWorkSourceMutationResult,
} from "../helpers/builders";

const fetchDlsiteInfo = vi.fn();
const applyDlsiteInfo = vi.fn();
const updateDlsiteState = vi.fn();

function makeWork(overrides: Partial<Work> = {}): Work {
  return buildWork({
    title: "現在タイトル",
    tags: ["サークル/夜想曲"],
    dlsite: { ...emptyDlsiteState(), rjCode: "RJ501001" },
    ...overrides,
  });
}

const makeSnapshot = buildWorkEditSnapshotOf;

function renderEditor(work: Work) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
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
    mockApi({
      "POST /api/dlsite/:id/fetch": () => fetchDlsiteInfo() as unknown,
      "POST /api/dlsite/:id/apply": () => applyDlsiteInfo() as unknown,
      "PATCH /api/dlsite/:id": () => updateDlsiteState() as unknown,
      "GET /api/settings": buildSettings(),
    });
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
    const preview = buildDlsitePreview();
    fetchDlsiteInfo.mockReturnValue(preview);
    applyDlsiteInfo.mockReturnValue(
      buildWorkSourceMutationResult(makeSnapshot(makeWork({ title: "取得タイトル" }))),
    );

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
    const preview = buildDlsitePreview();
    fetchDlsiteInfo.mockReturnValue(preview);
    applyDlsiteInfo.mockReturnValue(
      new Response("invalidate.run is not a function", { status: 500 }),
    );
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
    const preview = buildDlsitePreview({
      title: work.title,
      cvs: ["新CV"],
      coverUrl: null,
    });
    fetchDlsiteInfo.mockReturnValue(preview);

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
    const preview = buildDlsitePreview({
      title: "同一タイトル",
      coverUrl: null,
    });
    fetchDlsiteInfo.mockReturnValue(preview);

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
