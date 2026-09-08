// 未登録候補のタイトル・RJコード編集の安全性（TASK-428.19）。
import { createElement, Fragment } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspacePath, type ScanCandidate } from "@mimimilli/shared";
import UnregisteredTab from "../../src/features/scan/ui/scanModal/UnregisteredTab";
import GlobalToast from "../../src/app/ui/GlobalToast";
import * as scanApi from "../../src/features/scan/api";
import * as scanEntityApi from "../../src/entities/scan/api";
import * as scanCandidatesCache from "../../src/entities/scan/scanCandidatesCache";

afterEach(() => {
  vi.restoreAllMocks();
});

const candidateA: ScanCandidate = {
  path: workspacePath("dlsite/未検出作品"),
  inferredTitle: "未検出作品",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "mp3", count: 1 }],
  rjCode: null,
};
const candidateB: ScanCandidate = {
  path: workspacePath("dlsite/検出済み作品"),
  inferredTitle: "検出済み作品",
  audioFileCount: 2,
  audioBreakdown: [{ extension: "mp3", count: 2 }],
  rjCode: "RJ100001",
};

function renderTab(candidates: ScanCandidate[] = [candidateA, candidateB]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();
  const onRegistered = vi.fn();
  const view = render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(
          Fragment,
          null,
          createElement(UnregisteredTab, { candidates, onRegistered }),
          // Toastは単一ホスト（GlobalToast）へ集約されているため（TASK-440）、UnregisteredTabの
          // 表示要求を目に見える形で検証するにはGlobalToastも一緒に描画する必要がある。
          createElement(GlobalToast, {
            onOpenScan: () => {},
            onOpenScanNeedsAttention: () => {},
            onRetrySkippedTrack: () => {},
          }),
        ),
      ),
    ),
  );
  return { ...view, onRegistered };
}

describe("UnregisteredTab タイトル編集", () => {
  it("タイトルをクリックして編集し、確定すると表示と登録payloadへ反映される", async () => {
    const registerSpy = vi
      .spyOn(scanApi, "registerScanCandidates")
      .mockResolvedValue({ registered: [{ path: candidateA.path, workId: "w1" }], failures: [] });
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてタイトルを編集"));
    const input = screen.getByPlaceholderText("タイトル");
    fireEvent.change(input, { target: { value: "直したタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("直したタイトル")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /件をライブラリに追加/ }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([
      { path: candidateA.path, title: "直したタイトル", rjCode: "" },
    ]);
  });

  it("Escapeは編集だけを取り消し、タイトルを元に戻す", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてタイトルを編集"));
    const input = screen.getByPlaceholderText("タイトル");
    fireEvent.change(input, { target: { value: "書きかけの内容" } });
    const result = fireEvent.keyDown(input, { key: "Escape" });

    expect(result).toBe(false); // preventDefaultされ、モーダルのcancelへは伝播しない
    expect(screen.queryByPlaceholderText("タイトル")).toBeNull();
    expect(screen.getByText(candidateA.inferredTitle)).not.toBeNull();
  });

  it("空のタイトルでは確定できず、値と編集状態を保持する", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてタイトルを編集"));
    const input = screen.getByPlaceholderText("タイトル");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByPlaceholderText("タイトル")).not.toBeNull();
    expect(screen.getByText("タイトルを入力してください")).not.toBeNull();
  });
});

describe("UnregisteredTab RJコード編集", () => {
  it("Escapeはモーダルを閉じず編集だけを取り消す", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ12" } });
    const result = fireEvent.keyDown(input, { key: "Escape" });

    expect(result).toBe(false);
    expect(screen.queryByPlaceholderText("RJコード")).toBeNull();
    expect(screen.getByText("未検出")).not.toBeNull();
  });

  it("不正な値では値・focus・編集状態を保持して理由を表示する", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
    expect(input).toHaveValue("abc123");
    expect(screen.getByText(/RJ\/VJコードは/)).not.toBeNull();
  });

  it("IME変換中のEnter・Escapeは確定・取消のどちらも行わない", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ123456" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull(); // 編集中のまま

    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull(); // 編集中のまま
  });

  it("1行のRJコードが不正でも、正常な行だけを選んで登録できる（不正な行は自動的に除外される）", async () => {
    const registerSpy = vi
      .spyOn(scanApi, "registerScanCandidates")
      .mockResolvedValue({ registered: [{ path: candidateB.path, workId: "w2" }], failures: [] });
    renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // 不正な行は選択したままでもチェックボックスが無効化され、登録から自動的に除外される
    const checkboxA = screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`);
    expect(checkboxA).toBeDisabled();
    expect(screen.getByText(/エラーのある1件は登録から除外されます/)).not.toBeNull();

    const registerButton = screen.getByRole("button", { name: "1件をライブラリに追加" });
    expect(registerButton).not.toHaveAttribute("disabled");
    fireEvent.click(registerButton);

    await waitFor(() => expect(registerSpy).toHaveBeenCalledTimes(1));
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([
      { path: candidateB.path, title: candidateB.inferredTitle, rjCode: candidateB.rjCode },
    ]);
  });

  it("別の行を編集し始めても、エラー行の表示は消えたままにならない", () => {
    renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/RJ\/VJコードは/)).not.toBeNull();

    // 別の行（candidateB）のタイトル編集を開始する = candidateAのRJコード欄からフォーカスが離れる
    fireEvent.click(screen.getAllByTitle("クリックしてタイトルを編集")[1]);

    // candidateAのエラー表示・チェックボックス無効化は消えずに残る
    expect(screen.getByText(/RJ\/VJコードは/)).not.toBeNull();
    expect(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`)).toBeDisabled();
  });

  it("同じ不正値のままblurしても、そのたびに入力欄へフォーカスが戻る", () => {
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123" } });

    input.focus();
    input.blur();
    expect(document.activeElement).toBe(input);

    // 同じ不正値のまま再度blurしても、エラー文言が変化しないだけでフォーカスは戻る
    input.blur();
    expect(document.activeElement).toBe(input);
  });
});

describe("UnregisteredTab 候補から外す", () => {
  it("除外に成功するとトーストで取り消せる", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    const restoreSpy = vi
      .spyOn(scanEntityApi, "restoreScanCandidateExclusions")
      .mockResolvedValue(undefined);
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    renderTab([candidateA]);

    fireEvent.click(
      screen.getByRole("button", { name: `「${candidateA.inferredTitle}」を候補から外す` }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(`「${candidateA.inferredTitle}」を候補から外しました`),
      ).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith([candidateA.path]));
  });
});
