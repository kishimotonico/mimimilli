import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SmartFolderCounts } from "@mimimilli/shared";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import LibrarySidebarPanel from "../../src/features/library/ui/LibrarySidebarPanel";
import { groupsQueryOf, mockApi } from "../helpers/api";
import { buildGroupValueItem, buildTagPrefix } from "../helpers/builders";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { defaultSmartFolders } from "../helpers/smartFolders";

let sizeMock: { restore: () => void } | null = null;

afterEach(() => {
  cleanup();
  clearResizeObservers();
  sizeMock?.restore();
  sizeMock = null;
});

async function flushVirtualizer() {
  await waitFor(() => {
    expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    flushAllResizeObservers({ width: 260, height: 260 });
  });
}

const PREFIXES = [buildTagPrefix({ prefix: "cv", label: "CV", color: "cv", protected: true })];

const DEFAULT_COUNTS = { recent: 7, added: 0, fav: 4, error: 2 };

function renderSidebar(
  props: Partial<React.ComponentProps<typeof LibrarySidebarPanel>> & {
    counts?: SmartFolderCounts;
  },
) {
  const { counts = DEFAULT_COUNTS, ...panelProps } = props;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.counts(), counts);
  return render(
    <QueryClientProvider client={queryClient}>
      <div className="mle-app">
        <LibrarySidebarPanel
          folders={{ status: "ready", folders: defaultSmartFolders() }}
          activeFolderId="all"
          activeGroup={null}
          tagPrefixes={PREFIXES}
          onOpenFolder={vi.fn()}
          onReplaceFolder={vi.fn()}
          onOpenGroupValue={vi.fn()}
          onAddTag={vi.fn()}
          stats={{ status: "loading" }}
          {...panelProps}
        />
      </div>
    </QueryClientProvider>,
  );
}

describe("LibrarySidebarPanel", () => {
  it("ライブラリ統計をサイドバー最下部に常時表示する", () => {
    renderSidebar({
      stats: { status: "ready", count: 12, trackCount: 34, durationSec: 3661 },
    });

    expect(screen.getByText(/12作品.*34トラック/)).toBeInTheDocument();
  });

  it("統計取得に失敗した場合はエラー文言を表示する", () => {
    renderSidebar({ stats: { status: "error" } });

    expect(screen.getByText("統計の取得に失敗しました")).toBeInTheDocument();
  });

  it("スマートフォルダーをサーバーの順に並べ、件数はサーバー応答の値を出す", () => {
    renderSidebar({});

    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((text) => text !== "");
    expect(names.slice(0, 6)).toEqual([
      "すべて",
      "ランダム",
      "最近再生7",
      "最近追加0",
      "お気に入り4",
      "エラー2",
    ]);
    expect(screen.getByRole("button", { name: "CV別" })).toBeInTheDocument();
  });

  it("件数を出さないもの（条件が空・グループ分けあり）は件数を持っていても出さない", () => {
    renderSidebar({ counts: { all: 11, random: 11, "by-cv": 3 } });

    expect(screen.getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ランダム" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CV別" })).toBeInTheDocument();
  });

  it("エラー以外の0件の行は件数の0を出す", () => {
    renderSidebar({});

    expect(screen.getByRole("button", { name: "最近追加 0" })).toBeInTheDocument();
  });

  it("見出しは「ライブラリ」だけで、総称は出さない", () => {
    renderSidebar({});

    expect(screen.getByText("ライブラリ")).toBeInTheDocument();
    expect(screen.queryByText("スマートフォルダー")).toBeNull();
    expect(screen.queryByText("項目")).toBeNull();
  });

  it("エラーの行の件数は赤い丸で出す", () => {
    renderSidebar({ counts: { error: 2, fav: 5 } });

    const errorRow = screen.getByRole("button", { name: /^エラー/ });
    expect(errorRow.querySelector(".ct")).toHaveClass("is-error");
    expect(
      screen.getByRole("button", { name: /^お気に入り/ }).querySelector(".ct"),
    ).not.toHaveClass("is-error");
  });

  it("エラーの行は0件でも出し続け、赤い丸は出さない", () => {
    renderSidebar({ counts: { error: 0 } });

    expect(screen.getByRole("button", { name: "エラー" }).querySelector(".ct")).toBeNull();
  });

  it("一覧の取得に失敗したときは再試行を出す", async () => {
    const onRetry = vi.fn();
    renderSidebar({ folders: { status: "error", onRetry } });

    await userEvent.click(screen.getByRole("button", { name: /再試行/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("開いているスマートフォルダーに aria-current を付与する", () => {
    renderSidebar({ activeFolderId: "fav" });

    expect(screen.getByRole("button", { name: /お気に入り/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "すべて" })).not.toHaveAttribute("aria-current");
  });

  it("行のクリックで onOpenFolder を呼ぶ", async () => {
    const onOpenFolder = vi.fn();
    renderSidebar({ onOpenFolder });

    await userEvent.click(screen.getByRole("button", { name: /お気に入り/ }));
    expect(onOpenFolder).toHaveBeenCalledWith("fav");
  });

  it("初回レンダー直後（再レンダーを挟まない）の最初のホバーでもクイックオーバーレイが開く", async () => {
    mockApi({ "GET /api/smart-folders/:id/groups": [] });
    renderSidebar({});

    // マウント直後、再レンダーを一切挟まずに最初のpointerEnterを発火する。実ブラウザでは
    // 本物のホバーに必ず document レベルの pointermove が先行する（ホバーガードが
    // 誤起動と区別する材料）ため、テストでも先に発火させておく。
    fireEvent.pointerMove(document);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "CV別" }));

    await waitFor(() => {
      expect(document.querySelector(".mll-qoverlay")).toBeInTheDocument();
    });
  });

  it("クイックオーバーレイはそのフォルダーの保存済みの値の並びで開き、列見出しでの変更は開いている間だけの一時状態", async () => {
    const api = mockApi({
      "GET /api/smart-folders/:id/groups": [buildGroupValueItem({ value: "2025", count: 3 })],
    });
    renderSidebar({});

    fireEvent.keyDown(screen.getByRole("button", { name: "追加年別" }), { key: "ArrowRight" });
    await waitFor(() =>
      expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    expect(groupsQueryOf(api.requestsTo("GET /api/smart-folders/:id/groups")[0]!)).toMatchObject({
      groupSort: "name-desc",
    });

    await userEvent.click(screen.getByRole("button", { name: /^ソート/ }));
    await userEvent.click(screen.getByRole("button", { name: "件数" }));

    await waitFor(() =>
      expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(2),
    );
    expect(groupsQueryOf(api.requestsTo("GET /api/smart-folders/:id/groups")[1]!)).toMatchObject({
      groupSort: "count-desc",
    });
    expect(api.requestsTo("PATCH /api/smart-folders/:id")).toHaveLength(0);
  });

  it("オーバーレイ閉鎖（退出）中も値一覧が空にならない", async () => {
    mockApi({
      "GET /api/smart-folders/:id/groups": [buildGroupValueItem({ value: "藤田茜", count: 3 })],
    });
    renderSidebar({});

    // ArrowRight で遅延なしに開く（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });

    // 読み込み完了で「CVがありません」（空表示）が出ないこと（＝1件の値が一覧に載っている）
    // を、一覧本体（role="group"）の出現で確認する。
    await waitFor(() => {
      expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
    });

    // Escape で閉じる（コーディネーターの close() は遅延なし。閉鎖直後もAnimatePresenceが
    // 退出アニメーション完了まで内容を保持するため、この時点ではDOMから消えていない）。
    fireEvent.keyDown(screen.getByLabelText("CVの値を検索"), { key: "Escape" });

    // クエリが無効化されて空扱いになっていれば「CVがありません」に切り替わる。
    // 退出中も一覧本体が保持されたままであることを確認する。
    expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
    expect(screen.queryByText("CVがありません")).toBeNull();
  });

  it("グループ分けA→B高速切替で新パネルが閉じず、検索欄フォーカスが奪われない", async () => {
    mockApi({ "GET /api/smart-folders/:id/groups": [] });
    renderSidebar({});

    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByLabelText("CVの値を検索")).toBeInTheDocument();
    });

    // 退出アニメーション完了を待たず、別のグループ分けへ即座に切り替える（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: "追加年別" }), { key: "ArrowRight" });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("追加年の値を検索"));
    });
    // 新パネルが開いたまま維持されている（閉じていない）。
    expect(screen.getByLabelText("追加年の値を検索")).toBeInTheDocument();
  });

  it("クイックオーバーレイの値は主クリックもCtrl+クリックもその値の作品一覧（onOpenGroupValue）へ進む", async () => {
    mockApi({
      "GET /api/smart-folders/:id/groups": [buildGroupValueItem({ value: "藤田茜", count: 3 })],
    });
    sizeMock = mockElementSize(260, 260);
    const onOpenGroupValue = vi.fn();
    renderSidebar({ onOpenGroupValue });

    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });
    await flushVirtualizer();
    fireEvent.click(await screen.findByRole("button", { name: /^藤田茜 ?3/ }));
    expect(onOpenGroupValue).toHaveBeenLastCalledWith("by-cv", "藤田茜");

    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });
    await flushVirtualizer();
    fireEvent.click(await screen.findByRole("button", { name: /^藤田茜 ?3/ }), { ctrlKey: true });
    expect(onOpenGroupValue).toHaveBeenLastCalledWith("by-cv", "藤田茜");
  });

  it("クイックオーバーレイの追加ボタンは値をチップの候補として onAddTag へ渡す", async () => {
    mockApi({
      "GET /api/smart-folders/:id/groups": [buildGroupValueItem({ value: "藤田茜", count: 3 })],
    });
    sizeMock = mockElementSize(260, 260);
    const onAddTag = vi.fn();
    renderSidebar({ onAddTag });

    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });
    await flushVirtualizer();
    await screen.findByRole("button", { name: /^藤田茜 ?3/ });
    const addButton = document.querySelector<HTMLButtonElement>(".mll-qlist__add");
    expect(addButton).not.toBeNull();
    fireEvent.click(addButton!);
    expect(onAddTag).toHaveBeenCalledWith("cv/藤田茜");
  });
  it("＋メニューは絞り込みがあれば「今の検索を保存」、無ければ「複製」を出す", async () => {
    const onSaveSearch = vi.fn();
    const { unmount } = renderSidebar({ filtered: true, onSaveSearch });
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.queryByRole("menuitem", { name: /を複製$/ })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "今の検索を保存" }));
    expect(onSaveSearch).toHaveBeenCalledTimes(1);
    unmount();

    renderSidebar({ filtered: false, onSaveSearch });
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.queryByRole("menuitem", { name: "今の検索を保存" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "「すべて」を複製" })).toBeInTheDocument();
  });
});
