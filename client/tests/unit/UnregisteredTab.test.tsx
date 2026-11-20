import { act, createElement, Fragment } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiRequestError } from "../../src/shared/api/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ScanCandidate } from "@mimimilli/shared";
import type { ScanCandidatesRegisterOutcome } from "../../src/entities/work/api";
import UnregisteredTab from "../../src/features/scan/ui/scanModal/unregistered/UnregisteredTab";
import GlobalToast from "../../src/app/ui/GlobalToast";
import * as scanApi from "../../src/features/scan/api";
import * as workApi from "../../src/entities/work/api";
import * as scanEntityApi from "../../src/entities/scan/api";
import * as scanCandidatesCache from "../../src/entities/scan/scanCandidatesCache";
import { scanCandidateDeselectedPathsAtom } from "../../src/entities/scan/model/atoms";
import { dlsiteJobStoreAtom } from "../../src/entities/dlsite/model/dlsiteJobStore";
import { mockApi } from "../helpers/api";
import { useScanCandidatesCache } from "../../src/features/scan/model/useScanCandidatesCache";
import { buildScanCandidate } from "../helpers/builders";
import { createFakeDlsiteJobStore } from "../helpers/fakeJobStores";
import { clearResizeObservers } from "./setup";
import {
  flushUnregisteredListSize,
  mockUnregisteredListSize,
} from "../helpers/unregisteredListSize";

let restoreSize: () => void;
beforeEach(() => {
  restoreSize = mockUnregisteredListSize();
  mockApi({ "GET /api/scan/candidates": { scanCompleted: true, candidates: [] } });
});

afterEach(() => {
  cleanup();
  clearResizeObservers();
  vi.restoreAllMocks();
  restoreSize();
});

const candidateA = buildScanCandidate({
  path: "dlsite/未検出作品",
  inferredTitle: "未検出作品",
});
const candidateB = buildScanCandidate({
  path: "dlsite/検出済み作品",
  inferredTitle: "検出済み作品",
  audioFileCount: 2,
  rjCode: "RJ100001",
});

async function renderTab(
  candidates: ScanCandidate[] = [candidateA, candidateB],
  jobOverrides: Parameters<typeof createFakeDlsiteJobStore>[0] = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const job = createFakeDlsiteJobStore(jobOverrides);
  store.set(dlsiteJobStoreAtom, job);
  const onRegistered = vi.fn();
  const tree = (list: ScanCandidate[]) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(
          Fragment,
          null,
          createElement(UnregisteredTab, { candidates: list, onRegistered }),
          createElement(GlobalToast, {
            onOpenScan: () => {},
            onOpenScanNeedsAttention: () => {},
            onRetrySkippedTrack: () => {},
          }),
        ),
      ),
    );
  const view = render(tree(candidates));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushUnregisteredListSize();
  });
  return {
    ...view,
    onRegistered,
    queryClient,
    store,
    job,
    rerenderWith: (l: ScanCandidate[]) => view.rerender(tree(l)),
  };
}

describe("UnregisteredTab 仮想リスト", () => {
  it("1000件でも見えている行だけを描画する", async () => {
    const many = Array.from({ length: 1000 }, (_, index) =>
      buildScanCandidate({ path: `d/${index}`, inferredTitle: `作品${index}` }),
    );
    await renderTab(many);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(40);
  });
});

describe("UnregisteredTab RJコード編集", () => {
  it("RJコードが無い候補は「—」を出す", async () => {
    await renderTab([candidateA]);
    expect(screen.getByTitle("クリックしてRJコードを編集")).toHaveTextContent("—");
  });

  it("Escapeはモーダルを閉じず編集だけを取り消す", async () => {
    await renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ12" } });
    const result = fireEvent.keyDown(input, { key: "Escape" });

    expect(result).toBe(false);
    expect(screen.queryByPlaceholderText("RJコード")).toBeNull();
    expect(screen.getByTitle("クリックしてRJコードを編集")).toHaveTextContent("—");
  });

  it("不正な値では値・focus・編集状態を保持して理由を表示する", async () => {
    await renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
    expect(input).toHaveValue("abc123");
    expect(document.activeElement).toBe(input);
  });

  it("不正な値が残った行では、RJコード欄のtitleに理由が出る", async () => {
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // 別の行の編集を始めると、元の行は表示に戻り、理由はtitleに残る
    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    expect(screen.getByTitle(/RJ\/VJコードは/)).toHaveTextContent("abc123");
  });

  it("IME変換中のEnter・Escapeは確定・取消のどちらも行わない", async () => {
    await renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ123456" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
  });

  it("1行のRJコードが不正でも、正常な行だけを選んで追加できる", async () => {
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateB.path, workId: "w2", coverSkipped: null }],
      failures: [],
      interruptedBy: null,
    });
    await renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));

    await waitFor(() => expect(registerSpy).toHaveBeenCalledTimes(1));
    expect(registerSpy.mock.calls[0]).toEqual([
      [candidateB.path],
      { title: true, cover: true, tags: true, url: true },
    ]);
  });

  it("正しい値を確定すると修正APIを呼び、応答の候補で一覧キャッシュの行を置き換える", async () => {
    const fixed: ScanCandidate = { ...candidateA, rjCode: "RJ200002" };
    const setSpy = vi.spyOn(scanApi, "setScanCandidateRjCode").mockResolvedValue(fixed);
    const refreshSpy = vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    const { queryClient } = await renderTab([candidateA, candidateB]);
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
    expect(refreshSpy).toHaveBeenCalledWith(queryClient, { replace: fixed });
  });

  it("RJコードを空にして確定すると、空文字で修正APIを呼ぶ", async () => {
    const setSpy = vi
      .spyOn(scanApi, "setScanCandidateRjCode")
      .mockResolvedValue({ ...candidateB, rjCode: null });
    await renderTab([candidateB]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(candidateB.path, ""));
  });

  it("値を変えずに確定したときは修正APIを呼ばず編集だけ閉じる", async () => {
    const setSpy = vi.spyOn(scanApi, "setScanCandidateRjCode");
    await renderTab([candidateB]);

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
    await renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ200002" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    expect(screen.getByText(/候補が更新されたため表示を更新しました/)).not.toBeNull();
  });

  it("別の行を編集し始めても、不正な行の無効化は残る", async () => {
    await renderTab([candidateA, candidateB]);

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    expect(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`)).toBeDisabled();
  });

  it("同じ不正値のままblurしても、そのたびに入力欄へフォーカスが戻る", async () => {
    await renderTab([candidateA]);

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123" } });
    input.focus();
    input.blur();
    expect(document.activeElement).toBe(input);
    input.blur();
    expect(document.activeElement).toBe(input);
  });
});

describe("UnregisteredTab DLsite列と行の操作", () => {
  const notFound = buildScanCandidate({
    path: "d/nf",
    inferredTitle: "該当なし作品",
    rjCode: "RJ000403",
    dlsite: { state: "not_found" },
  });
  const failed = buildScanCandidate({
    path: "d/fail",
    inferredTitle: "失敗作品",
    rjCode: "RJ000404",
    dlsite: { state: "failed" },
  });
  const fetched = buildScanCandidate({
    path: "d/ok",
    inferredTitle: "フォルダー名",
    rjCode: "RJ000401",
    dlsite: {
      state: "fetched",
      title: "DLsiteのタイトル",
      cover: { key: "a".repeat(64), version: 1 },
    },
  });

  it("状態ごとの表示と、取得済みはDLsiteのタイトルを主にフォルダー名を添える", async () => {
    await renderTab([notFound, failed, fetched, candidateB]);
    expect(screen.getByText("該当なし")).not.toBeNull();
    expect(screen.getByText("失敗")).not.toBeNull();
    expect(screen.getByText("取得済み")).not.toBeNull();
    expect(screen.getByText("DLsiteのタイトル")).not.toBeNull();
    expect(screen.getByText("フォルダー名")).not.toBeNull();
  });

  it("「修正」はRJコード欄を編集状態にする", async () => {
    await renderTab([notFound]);
    fireEvent.click(screen.getByRole("button", { name: "修正" }));
    expect(screen.getByPlaceholderText("RJコード")).not.toBeNull();
  });

  it("「再試行」は単発の取得だけを始め、枠は「DLsiteから取得」のまま", async () => {
    const { job } = await renderTab([failed]);
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(job.startSingle).toHaveBeenCalledWith("RJ000404");
    expect(screen.getByRole("button", { name: "DLsiteから取得" })).not.toBeNull();
    expect(screen.queryByText(/取得中 \d/)).toBeNull();
  });

  it("RJコードを直した行（未取得）に「取得」が出て単発で取得する", async () => {
    const edited = buildScanCandidate({
      path: "d/edited",
      inferredTitle: "直した作品",
      rjCode: "RJ000777",
      rjCodeEdited: true,
    });
    const { job } = await renderTab([edited, candidateB]);
    expect(screen.getAllByRole("button", { name: "取得" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "取得" }));
    expect(job.startSingle).toHaveBeenCalledWith("RJ000777");
  });

  it("行方不明の作品と同じRJコードの行に注記が出る", async () => {
    const withMissing = buildScanCandidate({
      path: "d/m",
      inferredTitle: "移動した作品",
      rjCode: "RJ501010",
      missingWorks: [{ workId: "w1", title: "元の作品" }],
    });
    await renderTab([withMissing]);
    expect(screen.getByText("行方不明: 元の作品")).not.toBeNull();
  });

  it("問題のある候補だけを表示して、すべて表示に戻せる。問題が無ければリンクは出ない", async () => {
    await renderTab([notFound, failed, fetched]);
    fireEvent.click(screen.getByRole("button", { name: "問題のある2件だけ表示" }));
    expect(screen.queryByText("DLsiteのタイトル")).toBeNull();
    expect(screen.getByText("失敗作品")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "すべて表示" }));
    expect(screen.getByText("DLsiteのタイトル")).not.toBeNull();
  });
});

describe("UnregisteredTab 取得の枠", () => {
  const first = buildScanCandidate({ path: "d/1", inferredTitle: "一", rjCode: "RJ000001" });
  const second = buildScanCandidate({ path: "d/2", inferredTitle: "二", rjCode: "RJ000002" });

  it("選択中で未取得のRJコードだけを対象に取得を始める", async () => {
    const { job } = await renderTab([first, second, candidateA]);
    expect(screen.getByText(/2件・約/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "DLsiteから取得" }));
    expect(job.startBulk).toHaveBeenCalledWith(["RJ000001", "RJ000002"]);
  });

  it("まとめての取得中は枠が進捗と中止に替わり、単発の取得では替わらない", async () => {
    const { job } = await renderTab([first, second]);
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([
            ["RJ000001", { origin: "bulk", state: "fetching" }],
            ["RJ000002", { origin: "bulk", state: "queued" }],
          ]),
          bulk: { processed: 0, total: 2 },
        },
      }));
    });
    expect(screen.getByRole("progressbar", { name: "DLsite取得の進捗" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "DLsiteから取得" })).toBeNull();
    expect(screen.getByRole("button", { name: "中止" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "中止" }));
    expect(job.cancelBulk).toHaveBeenCalled();
  });

  it("単発だけのジョブでは枠は変わらない", async () => {
    const { job } = await renderTab([first]);
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000001", { origin: "single", state: "fetching" }]]),
          bulk: { processed: 0, total: 0 },
        },
      }));
    });
    expect(screen.queryByRole("button", { name: "中止" })).toBeNull();
    expect(screen.getByRole("button", { name: "DLsiteから取得" })).not.toBeNull();
  });

  it("アンマウント後に開き直しても、ストアの進捗がそのまま出る", async () => {
    const { job, unmount, store } = await renderTab([first]);
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000001", { origin: "bulk", state: "queued" }]]),
          bulk: { processed: 0, total: 1 },
        },
      }));
    });
    unmount();
    const queryClient = new QueryClient();
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(UnregisteredTab, { candidates: [first], onRegistered: vi.fn() }),
        ),
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole("button", { name: "中止" })).not.toBeNull();
  });
});

describe("UnregisteredTab 除外", () => {
  it("行ごとの除外ボタンは無く、ツールバーの除外で選択中を除外して取り消せる", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    const restoreSpy = vi
      .spyOn(scanEntityApi, "restoreScanCandidateExclusions")
      .mockResolvedValue(undefined);
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    await renderTab([candidateA, candidateB]);

    expect(screen.queryByRole("button", { name: /候補から外す/ })).toBeNull();
    fireEvent.click(screen.getByLabelText(`「${candidateB.inferredTitle}」を選択`));
    fireEvent.click(screen.getByRole("button", { name: "除外" }));

    await waitFor(() =>
      expect(scanApi.excludeScanCandidates).toHaveBeenCalledWith([candidateA.path]),
    );
    await waitFor(() => expect(screen.getByText("1件を候補から外しました")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith([candidateA.path]));
  });

  it("絞り込み中の「すべて選択」と除外は表示中の行だけに効く", async () => {
    const problem = buildScanCandidate({
      path: "d/p",
      inferredTitle: "問題作品",
      rjCode: "RJ000404",
      dlsite: { state: "failed" },
    });
    const spy = vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    await renderTab([problem, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: "問題のある1件だけ表示" }));
    fireEvent.click(screen.getByRole("button", { name: "除外" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith([problem.path]));
  });

  it("選択はatomに残り、外した候補は追加の対象にならない", async () => {
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [],
      interruptedBy: new Error("x"),
    });
    const { store } = await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));
    expect(store.get(scanCandidateDeselectedPathsAtom)).toEqual(new Set([candidateA.path]));
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([candidateB.path]);
  });
});

describe("UnregisteredTab 追加", () => {
  it("取得中の候補は追加の対象から外れ、DLsite情報なしの件数が出る", async () => {
    const fetching = buildScanCandidate({
      path: "d/f",
      inferredTitle: "取得中",
      rjCode: "RJ000001",
    });
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateB.path, workId: "w", coverSkipped: null }],
      failures: [],
      interruptedBy: null,
    });
    const { job } = await renderTab([fetching, candidateB, candidateA]);
    expect(screen.getByText("うち2件はDLsite情報なし")).not.toBeNull();
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000001", { origin: "bulk", state: "fetching" }]]),
          bulk: { processed: 0, total: 1 },
        },
      }));
    });
    expect(screen.getByText("うち1件はDLsite情報なし")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([candidateB.path, candidateA.path]);
  });

  it("RJコードの無い候補だけなら「DLsite情報なし」を出さない", async () => {
    await renderTab([candidateA]);
    expect(screen.queryByText(/DLsite情報なし/)).toBeNull();
  });

  it("項目を選んで追加では、外した項目がfalseで送られる", async () => {
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateA.path, workId: "w", coverSkipped: null }],
      failures: [],
      interruptedBy: null,
    });
    await renderTab([candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "項目を選んで追加…" }));
    fireEvent.click(screen.getByLabelText("カバー"));
    const dialog = screen.getByRole("dialog", { name: "追加する項目" });
    fireEvent.click(dialog.querySelector("button") as HTMLElement);
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[1]).toEqual({
      title: true,
      cover: false,
      tags: true,
      url: true,
    });
  });

  it("サーバーの失敗理由をそのまま表示する", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      interruptedBy: null,
      registered: [],
      failures: [{ path: candidateA.path, message: "配下に登録済み作品が1件あります" }],
    });
    await renderTab([candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));
    await waitFor(() => expect(screen.getByText("配下に登録済み作品が1件あります")).not.toBeNull());
  });

  it("途中で候補変更が起きても、追加できた分はonRegisteredへ渡す", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateA.path, workId: "w-a", coverSkipped: null }],
      failures: [],
      interruptedBy: new ApiRequestError(409, "conflict", "候補が更新されました"),
    });
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    const { onRegistered } = await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() =>
      expect(
        screen.getByText("候補が更新されたため表示を更新しました。選び直してください。"),
      ).not.toBeNull(),
    );
    expect(onRegistered).toHaveBeenCalledWith({
      registeredCount: 1,
      failedCount: 0,
      coverSkippedCount: 0,
      interrupted: true,
    });
  });

  it("1件も追加できないまま止まったときは失敗を表示し、0件の結果をonRegisteredへ渡す", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [],
      interruptedBy: new Error("通信エラー"),
    });
    const { onRegistered } = await renderTab([candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));
    await waitFor(() =>
      expect(screen.getByText(/通信エラー|ライブラリへの追加に失敗/)).not.toBeNull(),
    );
    expect(onRegistered).toHaveBeenCalledWith({
      registeredCount: 0,
      failedCount: 0,
      coverSkippedCount: 0,
      interrupted: true,
    });
  });

  it("中断なしで全件失敗しても、失敗理由を表示し、0件の結果をonRegisteredへ渡す", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [{ path: candidateA.path, message: "配下に登録済み作品が1件あります" }],
      interruptedBy: null,
    });
    const { onRegistered } = await renderTab([candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));
    await waitFor(() => expect(screen.getByText("配下に登録済み作品が1件あります")).not.toBeNull());
    expect(onRegistered).toHaveBeenCalledWith({
      registeredCount: 0,
      failedCount: 1,
      coverSkippedCount: 0,
      interrupted: false,
    });
  });

  it("カバーを適用できなかった件数をonRegisteredへ渡す", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [
        { path: candidateA.path, workId: "w-a", coverSkipped: "not_cached" },
        { path: candidateB.path, workId: "w-b", coverSkipped: null },
      ],
      failures: [],
      interruptedBy: null,
    });
    const { onRegistered } = await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() =>
      expect(onRegistered).toHaveBeenCalledWith({
        registeredCount: 2,
        failedCount: 0,
        coverSkippedCount: 1,
        interrupted: false,
      }),
    );
  });

  it("追加後は、候補が取り直されて行が消えるまで操作中のままになる", async () => {
    vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateA.path, workId: "w-a", coverSkipped: null }],
      failures: [],
      interruptedBy: null,
    });
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const api = mockApi({
      "GET /api/scan/candidates": async () => {
        await refreshGate;
        return { scanCompleted: true, candidates: [candidateB] };
      },
    });
    const key = scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY;
    const { queryClient, rerenderWith } = await renderTab([candidateA, candidateB]);
    queryClient.setQueryData(key, [candidateA, candidateB]);
    queryClient.getQueryCache().subscribe(() => {
      rerenderWith(queryClient.getQueryData<ScanCandidate[]>(key) ?? []);
    });
    const addButton = () => screen.getByRole("button", { name: /件を追加/ });
    fireEvent.click(addButton());

    await waitFor(() => expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(1));
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(candidateA.inferredTitle)).toBeInTheDocument();

    releaseRefresh();
    await waitFor(() => expect(screen.queryByText(candidateA.inferredTitle)).toBeNull());
    await waitFor(() => expect(addButton()).toBeEnabled());
  });

  it("追加リクエスト中にタブがアンマウントされても、候補が取り直されonRegisteredへ結果が届く", async () => {
    let resolveRegister!: (response: ScanCandidatesRegisterOutcome) => void;
    vi.spyOn(workApi, "registerScanCandidates").mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    const api = mockApi({
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [candidateB] },
    });
    const { onRegistered, unmount, queryClient } = await renderTab([candidateA, candidateB]);
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, [
      candidateA,
      candidateB,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() => expect(workApi.registerScanCandidates).toHaveBeenCalled());
    unmount();
    resolveRegister({
      interruptedBy: null,
      registered: [{ path: candidateA.path, workId: "w-a", coverSkipped: null }],
      failures: [{ path: candidateB.path, message: "失敗" }],
    });
    await waitFor(() =>
      expect(onRegistered).toHaveBeenCalledWith({
        registeredCount: 1,
        failedCount: 1,
        coverSkippedCount: 0,
        interrupted: false,
      }),
    );
    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(1);
    expect(queryClient.getQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY)).toEqual([
      candidateB,
    ]);
  });
});

describe("UnregisteredTab 終端表示", () => {
  it("終わったジョブがある状態で開いても候補を取り直さない", async () => {
    const refreshSpy = vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    await renderTab([candidateB], {
      job: {
        jobId: "job-1",
        status: "finished" as const,
        codes: new Map(),
        bulk: { processed: 0, total: 0 },
      },
    });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("候補を取り直さなくても、ジョブで見た終端の結果が候補より新しければ行に出す", async () => {
    const refreshSpy = vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
    const candidate = { ...candidateB, rjCode: "RJ000777", dlsiteRevision: 5 };
    await renderTab([candidate], {
      results: new Map([
        [
          "RJ000777",
          {
            dlsite: { state: "fetched" as const, title: "取得したタイトル", cover: null },
            revision: 30,
          },
        ],
      ]),
    });
    expect(await screen.findByText("取得したタイトル")).toBeInTheDocument();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe("UnregisteredTab 取り直し中のRJコード修正", () => {
  it("スキャン完了後の取り直しが出ている間にRJコードを確定しても、遅れて返った古い応答で表示が戻らない", async () => {
    const fixed: ScanCandidate = { ...candidateA, rjCode: "RJ200002", rjCodeEdited: true };
    const firstGate = Promise.withResolvers<void>();
    let calls = 0;
    mockApi({
      "GET /api/scan/candidates": async () => {
        calls += 1;
        if (calls === 1) {
          await firstGate.promise;
          return { scanCompleted: true, candidates: [candidateA] };
        }
        return { scanCompleted: true, candidates: [fixed] };
      },
    });
    vi.spyOn(scanApi, "setScanCandidateRjCode").mockResolvedValue(fixed);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, [candidateA]);
    const store = createStore();
    store.set(dlsiteJobStoreAtom, createFakeDlsiteJobStore());
    function Connected() {
      return createElement(UnregisteredTab, {
        candidates: useScanCandidatesCache(),
        onRegistered: () => {},
      });
    }
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store }, createElement(Connected)),
      ),
    );
    await act(async () => {
      flushUnregisteredListSize();
    });

    const refreshing = scanCandidatesCache.refreshScanCandidates(queryClient);
    await waitFor(() => expect(calls).toBe(1));

    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ200002" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("RJ200002")).toBeInTheDocument());

    firstGate.resolve();
    await refreshing;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByText("RJ200002")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
