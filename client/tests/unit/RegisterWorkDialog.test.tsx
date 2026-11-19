import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workRegisterPreviewSchema } from "@mimimilli/shared";
import { mockApi } from "../helpers/api";
import RegisterWorkDialog from "../../src/features/files/ui/RegisterWorkDialog";

const preview = workRegisterPreviewSchema.parse({
  suggestedTitle: "テスト作品",
  tags: [],
  detectedRjCode: null,
  descendantWorkCount: 0,
  alreadyRegistered: false,
  orphanedMeta: false,
});

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(
    <RegisterWorkDialog
      folderPath="/music/test"
      preview={preview}
      onRegistered={vi.fn()}
      onClose={vi.fn()}
    />,
    { wrapper },
  );
}

describe("RegisterWorkDialog", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    mockApi({ "GET /api/tags": [], "GET /api/tag-prefixes": [] });
  });

  it("targetKind=file のとき見出しをファイル向けにする", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    render(
      <RegisterWorkDialog
        folderPath="fanza/d00001.mp3"
        targetKind="file"
        preview={preview}
        onRegistered={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(
      screen.getByRole("heading", { name: "このファイルを作品として登録" }),
    ).toBeInTheDocument();
  });

  it("RJ/VJコード未入力で取得を押すとバリデーション文言を表示する", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "取得" }));

    expect(screen.getByText("RJ/VJコードを入力してください")).toBeInTheDocument();
    expect(screen.queryByText("DLsite情報の取得に失敗しました")).toBeNull();
  });

  it("配下に子作品があるとき警告を出し登録ボタンを無効化する", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    render(
      <RegisterWorkDialog
        folderPath="/music/parent"
        preview={{ ...preview, descendantWorkCount: 2 }}
        onRegistered={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(
      screen.getByText(/先に子作品の登録を解除してから親を登録してください/),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録" })).toBeDisabled();
  });

  describe("DLsite取得後のカバー", () => {
    const info = {
      rjCode: "RJ123456",
      title: "取得したタイトル",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: "https://img.dlsite.jp/modpub/images2/work/doujin/RJ123000/RJ123456_img_main.jpg",
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ123456.html",
    };
    const key = "a".repeat(64);

    async function fetchWith(cachedCover: { key: string; version: number } | null) {
      mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": { info, cachedCover },
      });
      renderDialog();
      fireEvent.change(screen.getByPlaceholderText("RJ123456"), { target: { value: "RJ123456" } });
      fireEvent.click(screen.getByRole("button", { name: "取得" }));
      await waitFor(() => expect(screen.getByDisplayValue("取得したタイトル")).toBeInTheDocument());
    }

    it("キャッシュ済みのカバーはサーバーの配信URLで表示し、DLsiteのURLは読まない", async () => {
      await fetchWith({ key, version: 1_700_000_000_000 });

      const image = document.querySelector("img");
      expect(image?.getAttribute("src")).toBe(`/api/media/dlsite-cover/${key}?v=1700000000000`);
      expect(screen.getByLabelText("カバー画像を適用")).toBeEnabled();
      expect(screen.getByLabelText("カバー画像を適用")).toBeChecked();
    });

    it("カバーがキャッシュに無いときは画像を出さず、カバー適用を選べない", async () => {
      await fetchWith(null);

      expect(document.querySelector("img")).toBeNull();
      expect(screen.getByLabelText("カバー画像を適用")).toBeDisabled();
      expect(screen.getByLabelText("カバー画像を適用")).not.toBeChecked();
    });
  });
});
