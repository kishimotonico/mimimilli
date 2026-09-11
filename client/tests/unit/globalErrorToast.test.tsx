import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { useToast } from "../../src/shared/ui/useToast";
import type { ToastPriority, ToastVariant } from "../../src/shared/model/toastRequestsAtom";

/** useToastの表示要求を任意のタイミングで発火するテスト用ハーネス。
 *  GlobalToastの唯一の責務（要求集合から1件を選んで表示する）だけを検証するため、
 *  個々のfeatureのatomではなくuseToastを直接叩く（design-system.md「単一ホストの優先順位チェーン」）。
 *  ボタンのラベルはトースト本文（span）と衝突しないよう分ける。 */
function ToastRequester({
  priority,
  variant = "success",
  message,
  onDismiss,
}: {
  priority: ToastPriority;
  variant?: ToastVariant;
  message: string;
  onDismiss?: () => void;
}) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show({ message, variant, priority, onDismiss })}>
      要求を出す: {message}
    </button>
  );
}

function renderGlobalToast(store: ReturnType<typeof createStore>, requesters: React.ReactNode) {
  render(
    createElement(
      JotaiProvider,
      { store },
      createElement("div", null, createElement(GlobalToast), requesters),
    ),
  );
}

// design-system.md「単一ホストの優先順位チェーン」の契約
// （error > action > notice > background）そのものを固定する。網羅はしない
// （AGENTS.md「テストは網羅性より実行速度」）。個々のfeatureがuseToastを正しい引数で
// 呼んでいるかは各featureのテスト・実機確認で見る。
describe("GlobalToast", () => {
  it("要求が無ければ何も表示しない", () => {
    const store = createStore();
    renderGlobalToast(store, null);
    expect(screen.queryByRole("output")).toBeNull();
  });

  it("優先度の異なる要求からpriorityの高い方を選ぶ（action > notice > background）", async () => {
    const store = createStore();
    renderGlobalToast(
      store,
      <>
        <ToastRequester priority="background" message="背景の通知" />
        <ToastRequester priority="notice" message="単発の通知" />
        <ToastRequester priority="action" message="操作の結果" />
      </>,
    );
    fireEvent.click(screen.getByText("要求を出す: 背景の通知"));
    fireEvent.click(screen.getByText("要求を出す: 単発の通知"));
    fireEvent.click(screen.getByText("要求を出す: 操作の結果"));

    // 破棄された要求のToastContentは退場アニメーション中は残る（motion）ため、
    // 最終的に1件だけになるのを待つ
    await waitFor(() =>
      expect(screen.getAllByText(/^(操作の結果|単発の通知|背景の通知)$/)).toHaveLength(1),
    );
    expect(screen.getByText("操作の結果")).toBeTruthy();
  });

  it("variant=errorは発行元が宣言したpriorityに関わらず最優先で選ばれる", async () => {
    const store = createStore();
    renderGlobalToast(
      store,
      <>
        <ToastRequester priority="action" message="操作の結果" />
        <ToastRequester priority="background" variant="error" message="致命的なエラー" />
      </>,
    );
    fireEvent.click(screen.getByText("要求を出す: 操作の結果"));
    fireEvent.click(screen.getByText("要求を出す: 致命的なエラー"));

    await waitFor(() =>
      expect(screen.getAllByText(/^(操作の結果|致命的なエラー)$/)).toHaveLength(1),
    );
    expect(screen.getByText("致命的なエラー")).toBeTruthy();
  });

  it("選ばれなかった要求は即座に破棄され、onDismissが同期的に呼ばれる", () => {
    const store = createStore();
    const onDismiss = vi.fn();
    renderGlobalToast(
      store,
      <>
        <ToastRequester priority="action" variant="error" message="既存のエラー" />
        <ToastRequester priority="action" message="候補から外しました" onDismiss={onDismiss} />
      </>,
    );
    fireEvent.click(screen.getByText("要求を出す: 既存のエラー"));
    fireEvent.click(screen.getByText("要求を出す: 候補から外しました"));

    expect(screen.queryByText("候補から外しました", { selector: "span" })).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("上位の要求が消えても、破棄済みの要求は改めて表示されない", () => {
    const store = createStore();
    const onDismiss = vi.fn();
    renderGlobalToast(
      store,
      <>
        <ToastRequester priority="action" variant="error" message="既存のエラー" />
        <ToastRequester priority="action" message="候補から外しました" onDismiss={onDismiss} />
      </>,
    );
    fireEvent.click(screen.getByText("要求を出す: 既存のエラー"));
    fireEvent.click(screen.getByText("要求を出す: 候補から外しました"));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByText("候補から外しました", { selector: "span" })).toBeNull();
  });

  it("onActionはピックされた要求のものだけが呼ばれる", () => {
    const store = createStore();
    const onAction = vi.fn();
    function Requester() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() =>
            toast.show({
              message: "候補を除外しました",
              variant: "success",
              priority: "action",
              actionLabel: "元に戻す",
              onAction,
            })
          }
        >
          出す
        </button>
      );
    }
    renderGlobalToast(store, <Requester />);
    fireEvent.click(screen.getByText("出す"));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
