import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import LibrarySidebarPanel from "../../src/features/library/ui/LibrarySidebarPanel";
import { mockApi } from "../helpers/api";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";
import { buildAxisFacetItem, buildTagPrefix } from "../helpers/builders";

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

function renderSidebar(props: Partial<React.ComponentProps<typeof LibrarySidebarPanel>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <div className="mle-app">
        <LibrarySidebarPanel
          folders={{
            status: "ready",
            folders: defaultSmartFolders({ recent: 7, added: 0, fav: 4, error: 2 }),
          }}
          activeFolderId="all"
          activeGroup={null}
          dataIntegrity={{ status: "ready", count: 0 }}
          tagPrefixes={PREFIXES}
          onOpenFolder={vi.fn()}
          onReplaceFolder={vi.fn()}
          onOpenGroupValue={vi.fn()}
          onAddTag={vi.fn()}
          stats={{ status: "loading" }}
          {...props}
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
    renderSidebar({
      folders: {
        status: "ready",
        folders: defaultSmartFolders({ all: 11, random: 11, "by-cv": 3 }),
      },
    });

    expect(screen.getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ランダム" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CV別" })).toBeInTheDocument();
  });

  it("エラー以外の0件の行は隠さない", () => {
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
    renderSidebar({});

    const errorRow = screen.getByRole("button", { name: /^エラー/ });
    expect(errorRow.querySelector(".ct")).toHaveClass("is-error");
    expect(
      screen.getByRole("button", { name: /^お気に入り/ }).querySelector(".ct"),
    ).not.toHaveClass("is-error");
  });

  it("エラーの行は、作品数が0でもデータ不整合が残っていれば出し続ける", () => {
    const folders = {
      status: "ready" as const,
      folders: defaultSmartFolders({ recent: 7, error: 0 }),
    };
    renderSidebar({ folders, dataIntegrity: { status: "ready", count: 3 } });

    expect(screen.getByRole("button", { name: /^エラー/ })).toBeInTheDocument();
  });

  it("エラーの行は、作品数もデータ不整合も0なら隠す。ただし開いている間は残す", () => {
    const folders = { status: "ready" as const, folders: defaultSmartFolders({ error: 0 }) };
    const { unmount } = renderSidebar({ folders });
    expect(screen.queryByRole("button", { name: /^エラー/ })).toBeNull();
    unmount();

    renderSidebar({ folders, activeFolderId: "error" });
    expect(screen.getByRole("button", { name: /^エラー/ })).toBeInTheDocument();
  });

  it("データ不整合の件数が取得中・取得失敗のあいだは、エラーの行を0件として隠さない", () => {
    const folders = { status: "ready" as const, folders: defaultSmartFolders({ error: 0 }) };
    renderSidebar({ folders, dataIntegrity: { status: "unknown" } });

    expect(screen.getByRole("button", { name: /^エラー/ })).toBeInTheDocument();
  });

  it("一覧の取得に失敗したときは再試行を出す", async () => {
    const onRetry = vi.fn();
    renderSidebar({ folders: { status: "error", onRetry } });

    await userEvent.click(screen.getByRole("button", { name: /再試行/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("旧のビュー軸・分類軸・スマートフォルダー欄は出さない", () => {
    renderSidebar({});

    expect(screen.queryByText("ビュー")).toBeNull();
    expect(screen.queryByText("分類軸")).toBeNull();
    expect(screen.queryByText(/新規スマートフォルダー/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^タグ$/ })).toBeNull();
  });

  it("読めない行は開けるが件数もクイックオーバーレイも持たない", () => {
    renderSidebar({
      folders: {
        status: "ready",
        folders: [
          ...defaultSmartFolders(),
          buildSmartFolder({ id: "sf-broken", name: "壊れた行", condition: null }),
        ],
      },
    });

    expect(screen.getByRole("button", { name: "壊れた行" })).not.toHaveAttribute("aria-expanded");
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
    mockApi({ "POST /api/smart-folders/:id/groups": [] });
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

  it("オーバーレイ閉鎖（退出）中もfacet一覧が空にならない", async () => {
    mockApi({
      "POST /api/smart-folders/:id/groups": [buildAxisFacetItem({ value: "藤田茜", count: 3 })],
    });
    renderSidebar({});

    // ArrowRight で遅延なしに開く（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });

    // 読み込み完了で「項目がありません」（空表示）が出ないこと（＝1件のfacetが一覧に載っている）
    // を、一覧本体（role="group"）の出現で確認する。
    await waitFor(() => {
      expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
    });

    // Escape で閉じる（コーディネーターの close() は遅延なし。閉鎖直後もAnimatePresenceが
    // 退出アニメーション完了まで内容を保持するため、この時点ではDOMから消えていない）。
    fireEvent.keyDown(screen.getByLabelText("CVの値を検索"), { key: "Escape" });

    // クエリが無効化されて空扱いになっていれば「項目がありません」に切り替わる。
    // 退出中も一覧本体が保持されたままであることを確認する。
    expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
    expect(screen.queryByText("項目がありません")).toBeNull();
  });

  it("軸A→B高速切替で新パネルが閉じず、検索欄フォーカスが奪われない", async () => {
    mockApi({ "POST /api/smart-folders/:id/groups": [] });
    renderSidebar({});

    fireEvent.keyDown(screen.getByRole("button", { name: "CV別" }), { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByLabelText("CVの値を検索")).toBeInTheDocument();
    });

    // 退出アニメーション完了を待たず、別軸へ即座に切り替える（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: "追加年別" }), { key: "ArrowRight" });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("追加日の値を検索"));
    });
    // 新パネルが開いたまま維持されている（閉じていない）。
    expect(screen.getByLabelText("追加日の値を検索")).toBeInTheDocument();
  });

  it("クイックオーバーレイの値は主クリックもCtrl+クリックもその値の作品一覧（onOpenGroupValue）へ進む", async () => {
    mockApi({
      "POST /api/smart-folders/:id/groups": [buildAxisFacetItem({ value: "藤田茜", count: 3 })],
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
      "POST /api/smart-folders/:id/groups": [buildAxisFacetItem({ value: "藤田茜", count: 3 })],
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
});
