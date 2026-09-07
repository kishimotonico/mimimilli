// 未登録候補のタイトル・RJコード編集の安全性（TASK-428.19）。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspacePath, type ScanCandidate } from "@mimimilli/shared";
import UnregisteredTab from "../../src/features/scan/ui/scanModal/UnregisteredTab";
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
        createElement(UnregisteredTab, { candidates, onRegistered }),
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
    expect(screen.getByRole("alert")).toHaveTextContent("タイトルを入力してください");
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
    expect(screen.getByRole("alert").textContent).toMatch(/RJ|VJ/);
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

  it("1行のRJコードが不正でも、正常な行だけを選んで登録できる", async () => {
    const registerSpy = vi
      .spyOn(scanApi, "registerScanCandidates")
      .mockResolvedValue({ registered: [{ path: candidateB.path, workId: "w2" }], failures: [] });
    renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // 不正な行を選択から外し、正常な行だけで登録する
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));

    const registerButton = screen.getByRole("button", { name: /件をライブラリに追加/ });
    expect(registerButton).not.toHaveAttribute("disabled");
    fireEvent.click(registerButton);

    await waitFor(() => expect(registerSpy).toHaveBeenCalledTimes(1));
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([
      { path: candidateB.path, title: candidateB.inferredTitle, rjCode: candidateB.rjCode },
    ]);
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
