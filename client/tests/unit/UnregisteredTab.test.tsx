// 未登録候補のRJコード編集の安全性。
import { createElement, Fragment } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiRequestError } from "../../src/shared/api/http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  workspacePath,
  type ScanCandidate,
  type ScanCandidatesRegisterResponse,
} from "@mimimilli/shared";
import UnregisteredTab from "../../src/features/scan/ui/scanModal/UnregisteredTab";
import GlobalToast from "../../src/app/ui/GlobalToast";
import * as scanApi from "../../src/features/scan/api";
import * as workApi from "../../src/entities/work/api";
import * as scanEntityApi from "../../src/entities/scan/api";
import * as scanCandidatesCache from "../../src/entities/scan/scanCandidatesCache";
import { scanCandidateHiddenPathsAtom } from "../../src/entities/scan/model/atoms";

afterEach(() => {
  vi.restoreAllMocks();
});

const candidateA: ScanCandidate = {
  path: workspacePath("dlsite/未検出作品"),
  inferredTitle: "未検出作品",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "mp3", count: 1 }],
  rjCode: null,
  dlsite: { state: "none" },
  missingWorks: [],
};
const candidateB: ScanCandidate = {
  path: workspacePath("dlsite/検出済み作品"),
  inferredTitle: "検出済み作品",
  audioFileCount: 2,
  audioBreakdown: [{ extension: "mp3", count: 2 }],
  rjCode: "RJ100001",
  dlsite: { state: "none" },
  missingWorks: [],
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
          // Toastは単一ホスト（GlobalToast）へ集約されているため、UnregisteredTabの
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
  return { ...view, onRegistered, queryClient };
}

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

    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull(); // 編集中のまま

    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull(); // 編集中のまま
  });

  it("1行のRJコードが不正でも、正常な行だけを選んで登録できる（不正な行は自動的に除外される）", async () => {
    const registerSpy = vi
      .spyOn(workApi, "registerScanCandidates")
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
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([{ path: candidateB.path }]);
  });

  it("正しい値を確定すると修正APIを呼び、応答の候補で一覧キャッシュの行を置き換える", async () => {
    const fixed: ScanCandidate = { ...candidateA, rjCode: "RJ200002" };
    const setSpy = vi.spyOn(scanApi, "setScanCandidateRjCode").mockResolvedValue(fixed);
    const { queryClient } = renderTab([candidateA, candidateB]);
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, [
      candidateA,
      candidateB,
    ]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: " rj200002 " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(candidateA.path, "RJ200002"));
    await waitFor(() => expect(screen.queryByPlaceholderText("RJコード")).toBeNull());
    expect(
      queryClient.getQueryData<ScanCandidate[]>(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY),
    ).toEqual([fixed, candidateB]);
  });

  it("RJコードを空にして確定すると、RJコードなしの明示として空文字で修正APIを呼ぶ", async () => {
    const cleared: ScanCandidate = { ...candidateB, rjCode: null };
    const setSpy = vi.spyOn(scanApi, "setScanCandidateRjCode").mockResolvedValue(cleared);
    renderTab([candidateB]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(candidateB.path, ""));
  });

  it("値を変えずに確定したときは修正APIを呼ばず編集だけ閉じる", async () => {
    const setSpy = vi.spyOn(scanApi, "setScanCandidateRjCode");
    renderTab([candidateB]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    fireEvent.keyDown(screen.getByPlaceholderText("RJコード"), { key: "Enter" });

    expect(screen.queryByPlaceholderText("RJコード")).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("候補が更新済み（409）のときは候補を取り直してメッセージを出す", async () => {
    vi.spyOn(scanApi, "setScanCandidateRjCode").mockRejectedValue(
      new ApiRequestError(409, "conflict", "候補プールが更新されました"),
    );
    const refreshSpy = vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ200002" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    expect(screen.getByText(/候補が更新されたため表示を更新しました/)).not.toBeNull();
  });

  it("別の行を編集し始めても、エラー行の表示は消えたままにならない", () => {
    renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/RJ\/VJコードは/)).not.toBeNull();

    // 別の行（candidateB）のRJコード編集を開始する = candidateAのRJコード欄からフォーカスが離れる
    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));

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

describe("UnregisteredTab 登録失敗", () => {
  it("サーバーの失敗理由をそのまま表示する", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [
        {
          path: candidateA.path,
          message:
            "配下に登録済み作品が1件あります。先に子作品の登録を解除してから親を登録してください",
        },
      ],
    });
    renderTab([candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "1件をライブラリに追加" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "配下に登録済み作品が1件あります。先に子作品の登録を解除してから親を登録してください",
        ),
      ).not.toBeNull(),
    );
  });
});

describe("UnregisteredTab 登録中のアンマウント", () => {
  it("登録リクエスト中にタブがアンマウントされても、非表示集合とonRegisteredへ登録結果が届く", async () => {
    let resolveRegister!: (response: ScanCandidatesRegisterResponse) => void;
    vi.spyOn(workApi, "registerScanCandidates").mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const store = createStore();
    const onRegistered = vi.fn();
    const view = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(UnregisteredTab, { candidates: [candidateA, candidateB], onRegistered }),
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "2件をライブラリに追加" }));
    await waitFor(() => expect(workApi.registerScanCandidates).toHaveBeenCalled());
    view.unmount();
    resolveRegister({
      registered: [{ path: candidateA.path, workId: "w-a" }],
      failures: [{ path: candidateB.path, message: "失敗" }],
    });

    await waitFor(() =>
      expect(onRegistered).toHaveBeenCalledWith({
        registeredWorkIds: ["w-a"],
        failedCount: 1,
        remainingCount: 1,
      }),
    );
    expect(store.get(scanCandidateHiddenPathsAtom)).toEqual(new Set([candidateA.path]));
  });
});
