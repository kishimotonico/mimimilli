import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TagPrefix } from "@mimimilli/shared";
import AxisColumn from "../../src/features/library/ui/AxisColumn";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true },
];

function renderAxisColumn(props: Partial<React.ComponentProps<typeof AxisColumn>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <div className="mle-app">
        <AxisColumn
          activeAxis="all"
          tagPrefixes={[]}
          smartFolders={[]}
          onSelectAxis={vi.fn()}
          selectedTags={[]}
          onToggleTag={vi.fn()}
          onReplaceTag={vi.fn()}
          onAddTag={vi.fn()}
          {...props}
        />
      </div>
    </QueryClientProvider>,
  );
}

describe("AxisColumn", () => {
  it("選択中のビュー項目に aria-current を付与する", () => {
    renderAxisColumn({
      activeAxis: "fav",
    });

    expect(screen.getByRole("button", { name: /お気に入り/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /すべての作品/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("tagPrefixes 取得失敗時、CV等のprefix軸が無言で消えず分類軸グループにエラー行を出す", () => {
    renderAxisColumn({
      isTagPrefixesError: true,
    });

    expect(screen.getByText("分類軸の取得に失敗しました")).toBeTruthy();
    // 組み込みのタグ・追加日は tagPrefixes に依存しないため引き続き表示される
    expect(screen.getByRole("button", { name: /タグ/ })).toBeTruthy();
  });

  it("エラー行の再試行ボタンをクリックすると onRetryTagPrefixes を呼ぶ", async () => {
    const onRetry = vi.fn();
    renderAxisColumn({
      isTagPrefixesError: true,
      onRetryTagPrefixes: onRetry,
    });

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tagPrefixes 取得成功時はエラー行を出さず、prefix軸を表示する", () => {
    renderAxisColumn({
      tagPrefixes: PREFIXES,
    });

    expect(screen.queryByText("分類軸の取得に失敗しました")).toBeNull();
    expect(screen.getByRole("button", { name: /CV/ })).toBeTruthy();
  });

  it("初回レンダー直後（再レンダーを挟まない）の最初のホバーでもクイックオーバーレイが開く", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    renderAxisColumn({ tagPrefixes: PREFIXES });

    // マウント直後、再レンダーを一切挟まずに最初のpointerEnterを発火する。
    fireEvent.pointerEnter(screen.getByRole("button", { name: /CV/ }));

    await waitFor(() => {
      expect(document.querySelector(".mll-qoverlay")).toBeTruthy();
    });
  });

  it("オーバーレイ閉鎖（退出）中もfacet一覧が空にならない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([{ value: "藤田茜", count: 3, durationSec: 0, covers: [] }]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    renderAxisColumn({ tagPrefixes: PREFIXES });

    // ArrowRight で遅延なしに開く（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: /CV/ }), { key: "ArrowRight" });

    // 読み込み完了で「項目がありません」（空表示）が出ないこと（＝1件のfacetが一覧に載っている）
    // を、一覧本体（role="group"）の出現で確認する。
    await waitFor(() => {
      expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeTruthy();
    });

    // Escape で閉じる（コーディネーターの close() は遅延なし。閉鎖直後もAnimatePresenceが
    // 退出アニメーション完了まで内容を保持するため、この時点ではDOMから消えていない）。
    fireEvent.keyDown(screen.getByLabelText("CVの値を検索"), { key: "Escape" });

    // クエリが無効化されて空扱いになっていれば「項目がありません」に切り替わる。
    // 退出中も一覧本体が保持されたままであることを確認する。
    expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeTruthy();
    expect(screen.queryByText("項目がありません")).toBeNull();
  });

  it("軸A→B高速切替で新パネルが閉じず、検索欄フォーカスが奪われない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    renderAxisColumn({ tagPrefixes: PREFIXES });

    fireEvent.keyDown(screen.getByRole("button", { name: /CV/ }), { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByLabelText("CVの値を検索")).toBeTruthy();
    });

    // 退出アニメーション完了を待たず、別軸へ即座に切り替える（openImmediately）。
    fireEvent.keyDown(screen.getByRole("button", { name: /追加日/ }), { key: "ArrowRight" });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("追加日の値を検索"));
    });
    // 新パネルが開いたまま維持されている（閉じていない）。
    expect(screen.getByLabelText("追加日の値を検索")).toBeTruthy();
  });
});
