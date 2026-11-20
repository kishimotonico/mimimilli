import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workRegisterPreviewSchema } from "@mimimilli/shared";
import { apiError, mockApi } from "../helpers/api";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import RegisterWorkDialog from "../../src/features/files/ui/RegisterWorkDialog";

const preview = workRegisterPreviewSchema.parse({
  suggestedTitle: "テスト作品",
  tags: [],
  detectedRjCode: null,
  descendantWorkCount: 0,
  alreadyRegistered: false,
  orphanedMeta: false,
});

function renderDialog(dialogPreview = preview) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const view = render(
    <RegisterWorkDialog
      folderPath="/music/test"
      preview={dialogPreview}
      onRegistered={vi.fn()}
      onClose={vi.fn()}
    />,
    { wrapper },
  );
  return { queryClient, ...view };
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
      screen.getByText(/先に子作品を登録解除してから親を登録してください/),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録" })).toBeDisabled();
  });

  describe("DLsite取得の契機", () => {
    const detected = { ...preview, detectedRjCode: "RJ123456" };

    it("検出したRJコードを入力欄の初期値にするが、開いただけでは取得しない", () => {
      const api = mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": new Response(null, { status: 500 }),
      });
      renderDialog(detected);

      expect(screen.getByPlaceholderText("RJ123456")).toHaveValue("RJ123456");
      expect(api.requestsTo("POST /api/dlsite/fetch-by-code")).toHaveLength(0);
    });

    it("取得ボタンは失敗の記録を無視して取り直す（force=true）", async () => {
      const api = mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": apiError(404, "not_found"),
      });
      renderDialog(detected);
      fireEvent.click(screen.getByRole("button", { name: "取得" }));

      await waitFor(() => expect(api.requestsTo("POST /api/dlsite/fetch-by-code")).toHaveLength(1));
      expect(api.urlsTo("POST /api/dlsite/fetch-by-code")).toEqual([
        "/api/dlsite/fetch-by-code?force=true",
      ]);
    });

    it("取得が終わると、成否にかかわらず同じRJコードの作品を無効化する", async () => {
      mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": apiError(404, "not_found"),
      });
      const { queryClient } = renderDialog(detected);
      queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), {
        id: "w1",
        dlsite: { rjCode: "RJ123456" },
      });
      queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), {
        id: "w2",
        dlsite: { rjCode: "RJ999999" },
      });
      fireEvent.click(screen.getByRole("button", { name: "取得" }));

      await waitFor(() =>
        expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true),
      );
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w2"))?.isInvalidated).toBe(false);
    });

    it("オフライン設定で失敗したときは、オフラインであることが分かる文言を出す", async () => {
      mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": apiError(503, "offline"),
      });
      renderDialog(detected);
      fireEvent.click(screen.getByRole("button", { name: "取得" }));

      await waitFor(() => expect(screen.getByText(/オフライン設定/)).toBeInTheDocument());
    });
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

    function mockRegister() {
      return mockApi({
        "GET /api/tags": [],
        "GET /api/tag-prefixes": [],
        "POST /api/dlsite/fetch-by-code": {
          info,
          cachedCover: { key, version: 1_700_000_000_000 },
        },
        "POST /api/works": {
          snapshot: {
            sourceRevision: "r1",
            id: "w1",
            physicalPath: "/music/test",
            title: "取得したタイトル",
            tags: [],
            urls: [],
            coverImage: null,
            dlsite: { rjCode: "RJ123456", status: "applied", appliedTags: [] },
          },
          projection: { status: "published" },
        },
      });
    }

    async function fetchThenRegister(afterFetch?: () => void) {
      const api = mockRegister();
      renderDialog();
      const input = screen.getByPlaceholderText("RJ123456");
      fireEvent.change(input, { target: { value: "RJ123456" } });
      fireEvent.click(screen.getByRole("button", { name: "取得" }));
      await waitFor(() => expect(screen.getByDisplayValue("取得したタイトル")).toBeInTheDocument());
      afterFetch?.();
      fireEvent.click(screen.getByRole("button", { name: "登録" }));
      await waitFor(() => expect(api.requestsTo("POST /api/works")).toHaveLength(1));
      return api.requestsTo("POST /api/works")[0]!.body;
    }

    it("取得した結果の入力のまま登録すると、カバーとURLの反映を送り、取得結果のinfoは送らない", async () => {
      const body = await fetchThenRegister();

      expect(body).toEqual({
        path: "/music/test",
        title: "取得したタイトル",
        tags: [],
        rjCode: "RJ123456",
        applyCover: true,
        applyUrl: true,
      });
    });

    it("取得後にRJコードを変えると、取得結果のカバーとURLは反映しない", async () => {
      const body = await fetchThenRegister(() => {
        fireEvent.change(screen.getByPlaceholderText("RJ123456"), {
          target: { value: "RJ654321" },
        });
        expect(screen.getByLabelText("カバー画像を適用")).toBeDisabled();
        expect(document.querySelector("img")).toBeNull();
      });

      expect(body).toMatchObject({ rjCode: "RJ654321", applyCover: false, applyUrl: false });
    });

    it("RJコードを空にすると、RJコードなしで登録する", async () => {
      const body = await fetchThenRegister(() => {
        fireEvent.change(screen.getByPlaceholderText("RJ123456"), { target: { value: "" } });
      });

      expect(body).toMatchObject({ rjCode: "", applyCover: false, applyUrl: false });
    });

    it("カバーのチェックを外すと、applyCoverをfalseで送る", async () => {
      const body = await fetchThenRegister(() => {
        fireEvent.click(screen.getByLabelText("カバー画像を適用"));
      });

      expect(body).toMatchObject({ applyCover: false, applyUrl: true });
    });

    it("形式違いのRJコードでは送信せず、エラーを表示する", async () => {
      const api = mockRegister();
      renderDialog();
      fireEvent.change(screen.getByPlaceholderText("RJ123456"), { target: { value: "xyz" } });
      fireEvent.click(screen.getByRole("button", { name: "登録" }));

      await waitFor(() => expect(screen.getByText(/RJまたはVJに続く6〜8桁/)).toBeInTheDocument());
      expect(api.requestsTo("POST /api/works")).toHaveLength(0);
    });
  });
});
