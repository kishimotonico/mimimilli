import { act, createElement, Fragment } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiRequestError } from "../../src/shared/api/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ScanCandidate, type ScanCandidatesResponse } from "@mimimilli/shared";
import type { ScanCandidatesRegisterOutcome } from "../../src/entities/work/api";
import UnregisteredTab from "../../src/features/scan/ui/scanModal/unregistered/UnregisteredTab";
import GlobalToast from "../../src/app/ui/GlobalToast";
import * as scanApi from "../../src/features/scan/api";
import * as workApi from "../../src/entities/work/api";
import * as scanEntityApi from "../../src/entities/scan/api";
import * as scanCandidatesCache from "../../src/entities/scan/scanCandidatesCache";
import { scanCandidateSelectionAtom } from "../../src/entities/scan/model/atoms";
import { dlsiteJobStoreAtom } from "../../src/entities/dlsite/model/dlsiteJobStore";
import { mockApi } from "../helpers/api";
import { useScanCandidatesState } from "../../src/features/scan/model/useScanCandidatesCache";
import { useScanSelectionPruning } from "../../src/features/scan/model/useScanSelectionPruning";
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
  mockApi({
    "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
    "GET /api/scan/candidates/exclusions": { paths: [] },
  });
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
  dlsite: { state: "fetched", title: "検出済みのDLsiteタイトル", cover: null },
});

function PruningProbe() {
  useScanSelectionPruning();
  return null;
}

async function renderUnmountableTab(candidates: ScanCandidate[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  store.set(dlsiteJobStoreAtom, createFakeDlsiteJobStore({}));
  const tree = (mounted: boolean) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(
          Fragment,
          null,
          mounted
            ? createElement(UnregisteredTab, {
                candidates,
                status: "ready",
                onRetry: () => {},
                onRegistered: () => {},
                onOpenFiles: () => {},
              })
            : null,
          createElement(GlobalToast, {
            onOpenScan: () => {},
            onOpenScanNeedsAttention: () => {},
            onRetrySkippedTrack: () => {},
          }),
        ),
      ),
    );
  const view = render(tree(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushUnregisteredListSize();
  });
  return { rerender: (mounted: boolean) => view.rerender(tree(mounted)) };
}

async function renderTab(
  candidates: ScanCandidate[] = [candidateA, candidateB],
  jobOverrides: Parameters<typeof createFakeDlsiteJobStore>[0] = {},
  options: { pruning?: boolean; status?: "ready" | "notScanned" | "error" } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const job = createFakeDlsiteJobStore(jobOverrides);
  store.set(dlsiteJobStoreAtom, job);
  const onRegistered = vi.fn();
  const onOpenFiles = vi.fn();
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
          createElement(UnregisteredTab, {
            candidates: list,
            status: options.status ?? "ready",
            onRetry: () => {},
            onRegistered,
            onOpenFiles,
          }),
          options.pruning ? createElement(PruningProbe) : null,
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
    onOpenFiles,
    queryClient,
    store,
    job,
    rerenderWith: (l: ScanCandidate[]) => view.rerender(tree(l)),
  };
}

describe("UnregisteredTab ツールバー", () => {
  it("未スキャンでも除外済みがあれば「除外済み」を出し、なければ帯ごと出さない", async () => {
    const spy = vi.spyOn(scanEntityApi, "getScanCandidateExclusions").mockResolvedValue([]);
    const view = await renderTab([], {}, { status: "notScanned" });
    expect(screen.queryByRole("button", { name: /除外済み/ })).toBeNull();
    expect(screen.queryByTestId("unregistered-toolbar")).toBeNull();
    view.unmount();
    spy.mockResolvedValue(["dlsite/除外した作品"]);
    await renderTab([], {}, { status: "notScanned" });
    expect(await screen.findByRole("button", { name: /除外済み/ })).toBeInTheDocument();
    expect(screen.getByTestId("unregistered-toolbar")).toBeInTheDocument();
  });
});

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

  it("不正な値が残った行では、入力欄の下に短い理由が出て、Escで元に戻る", async () => {
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/RJ\/VJ＋6〜8桁の数字/)).not.toBeNull();
    fireEvent.keyDown(screen.getByPlaceholderText("RJコード"), { key: "Escape" });
    expect(screen.queryByText(/RJ\/VJ＋6〜8桁の数字/)).toBeNull();
    expect(screen.getAllByTitle("クリックしてRJコードを編集")[0]).toHaveTextContent("—");
  });

  it("別の行の編集を始めても、不正な行の理由は残る", async () => {
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByTitle("クリックしてRJコードを編集"));
    expect(screen.getByText(/RJ\/VJ＋6〜8桁の数字/)).not.toBeNull();
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
    const refreshSpy = vi
      .spyOn(scanCandidatesCache, "refreshScanCandidates")
      .mockResolvedValue({ scanCompleted: true, candidates: [] });
    const { queryClient } = await renderTab([candidateA, candidateB]);
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [candidateA, candidateB],
    });

    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: " rj200002 " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(candidateA.path, "RJ200002"));
    await waitFor(() => expect(screen.queryByPlaceholderText("RJコード")).toBeNull());
    expect(refreshSpy).toHaveBeenCalledWith(queryClient, { replace: fixed });
  });

  it("形式エラーの行は未チェックの無効状態で数に入らず、すべて外すと全部外れてヘッダーも戻る", async () => {
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getAllByTitle("クリックしてRJコードを編集")[0]);
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const invalid = screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`);
    expect(invalid).toBeDisabled();
    expect(invalid).not.toBeChecked();
    expect(screen.getByText("件を選択").textContent).toBe("1件を選択");
    expect(screen.getByRole("button", { name: "1件を追加" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /問題あり/ })).not.toBeNull();

    const header = screen.getByLabelText("すべて選択") as HTMLInputElement;
    expect(header.checked).toBe(true);
    fireEvent.click(header);
    expect(screen.getByLabelText(`「${candidateB.dlsite.title}」を選択`)).not.toBeChecked();
    expect(header.checked).toBe(false);
    expect(header.indeterminate).toBe(false);
    expect(screen.getByText("件を選択").textContent).toBe("0件を選択");
  });

  it("RJコードを直した行は未取得に戻り、主ボタンが「DLsiteから取得」になる", async () => {
    const failedRow = buildScanCandidate({
      path: "d/fail",
      inferredTitle: "失敗作品",
      rjCode: "RJ000404",
      dlsite: { state: "failed" },
    });
    vi.spyOn(scanApi, "setScanCandidateRjCode").mockResolvedValue({
      ...failedRow,
      rjCode: "RJ000405",
      rjCodeEdited: true,
      dlsite: { state: "none" },
    });
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue({
      scanCompleted: true,
      candidates: [],
    });
    const { rerenderWith } = await renderTab([failedRow, candidateB]);
    expect(screen.getByRole("button", { name: /件を追加/ })).not.toBeNull();

    fireEvent.click(screen.getByText("RJ000404"));
    const input = screen.getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ000405" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(scanApi.setScanCandidateRjCode).toHaveBeenCalled());
    rerenderWith([
      { ...failedRow, rjCode: "RJ000405", rjCodeEdited: true, dlsite: { state: "none" } },
      candidateB,
    ]);

    expect(screen.getByRole("button", { name: "DLsiteから取得 1件" })).not.toBeNull();
    expect(screen.getByLabelText(`「${failedRow.inferredTitle}」を選択`)).toBeChecked();
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
    const refreshSpy = vi
      .spyOn(scanCandidatesCache, "refreshScanCandidates")
      .mockResolvedValue({ scanCompleted: true, candidates: [] });
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

  it("状態ごとの表示。取得済みはDLsiteのタイトル、それ以外はフォルダー名で、2行目にパスが出る", async () => {
    const unfetched = buildScanCandidate({
      path: "d/un",
      inferredTitle: "未取得作品",
      rjCode: "RJ000402",
    });
    await renderTab([notFound, failed, fetched, unfetched, candidateA]);
    expect(screen.getByText("該当なし")).not.toBeNull();
    expect(screen.getByText("失敗")).not.toBeNull();
    expect(screen.getByText("取得済み")).not.toBeNull();
    expect(screen.getByText("未取得")).not.toBeNull();
    expect(screen.getByText("—", { selector: "span.text-ink-3" })).not.toBeNull();
    expect(screen.getByText("DLsiteのタイトル")).not.toBeNull();
    expect(screen.queryByText("フォルダー名")).toBeNull();
    expect(screen.getByText("d/ok")).not.toBeNull();
    expect(screen.getByText("未取得作品")).toHaveAttribute("title", "未取得作品");
  });

  it("行の中に「修正」「再試行」「取得」のボタンは無い", async () => {
    const edited = buildScanCandidate({
      path: "d/edited",
      inferredTitle: "直した作品",
      rjCode: "RJ000777",
      rjCodeEdited: true,
    });
    await renderTab([notFound, failed, edited]);
    for (const name of ["修正", "再試行", "取得"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("失敗・該当なしの行は、選び直して主ボタンを押すと force で取り直す", async () => {
    const { job } = await renderTab([failed, notFound, candidateB]);
    fireEvent.click(screen.getByLabelText(`「${failed.inferredTitle}」を選択`));
    expect(screen.getByRole("button", { name: "DLsiteから取得 1件" })).not.toBeNull();
    fireEvent.click(screen.getByLabelText(`「${notFound.inferredTitle}」を選択`));
    fireEvent.click(screen.getByRole("button", { name: "DLsiteから取得 2件" }));
    expect(job.start).toHaveBeenCalledWith(["RJ000404", "RJ000403"], true);
  });

  it("行方不明の作品と同じRJコードの行に「行方不明」のチップが出て、旧作品の情報はhoverで出る", async () => {
    const withMissing = buildScanCandidate({
      path: "d/m",
      inferredTitle: "移動した作品",
      rjCode: "RJ501010",
      missingWorks: [{ workId: "w1", title: "元の作品", previousPath: "old/元の作品" }],
    });
    const sameTitle = buildScanCandidate({
      path: "d/s",
      inferredTitle: "同名",
      rjCode: "RJ501011",
      missingWorks: [{ workId: "w2", title: "同名", previousPath: null }],
    });
    await renderTab([withMissing, sameTitle]);
    const chip = screen.getByText("行方不明: 元の作品");
    expect(chip).toHaveAttribute("title", "行方不明の作品: 元の作品\n最後のパス: old/元の作品");
    expect(screen.getByText("行方不明")).toHaveAttribute("title", "行方不明の作品: 同名");
  });

  it("行方不明の作品と同じRJコードの行は既定で未選択になり、ほかの行は選択済みになる", async () => {
    const withMissing = buildScanCandidate({
      path: "d/m",
      inferredTitle: "移動した作品",
      rjCode: "RJ501010",
      missingWorks: [{ workId: "w1", title: "元の作品", previousPath: "old/元の作品" }],
    });
    const plain = buildScanCandidate({ path: "d/p", inferredTitle: "ふつうの作品" });
    await renderTab([withMissing, plain]);
    expect(screen.getByLabelText("「移動した作品」を選択")).not.toBeChecked();
    expect(screen.getByLabelText("「ふつうの作品」を選択")).toBeChecked();
  });

  it("「問題あり」は押した時点の行で固定され、チェックを外しても行は消えない。外すと戻る", async () => {
    await renderTab([notFound, failed, fetched]);
    fireEvent.click(screen.getByRole("button", { name: /問題あり/ }));
    expect(screen.queryByText("DLsiteのタイトル")).toBeNull();
    fireEvent.click(screen.getByLabelText(`「${failed.inferredTitle}」を選択`));
    expect(screen.getByText("失敗作品")).not.toBeNull();
    expect(screen.getByText("該当なし作品")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /問題あり/ }));
    expect(screen.getByText("DLsiteのタイトル")).not.toBeNull();
  });

  it("判断が要る行が無ければ「問題あり」は出ない", async () => {
    await renderTab([candidateA, candidateB]);
    expect(screen.queryByRole("button", { name: /問題あり/ })).toBeNull();
  });
});

describe("UnregisteredTab 取得と進捗", () => {
  const first = buildScanCandidate({ path: "d/1", inferredTitle: "一", rjCode: "RJ000001" });
  const second = buildScanCandidate({ path: "d/2", inferredTitle: "二", rjCode: "RJ000002" });

  it("選択中で未取得のRJコードだけを対象に取得を始める", async () => {
    const { job } = await renderTab([first, second, candidateA]);
    expect(screen.queryByText(/件・約/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "DLsiteから取得 2件" }));
    expect(job.start).toHaveBeenCalledWith(["RJ000001", "RJ000002"], false);
  });

  it("取り直した失敗の行を中止すると、失敗の表示に戻って未選択になる", async () => {
    const failedRow = buildScanCandidate({
      path: "d/fail",
      inferredTitle: "失敗作品",
      rjCode: "RJ000404",
      dlsite: { state: "failed" },
    });
    const { job, queryClient } = await renderTab([failedRow], {}, { pruning: true });
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [failedRow],
    });
    const checkbox = () => screen.getByLabelText(`「${failedRow.inferredTitle}」を選択`);
    fireEvent.click(checkbox());
    expect(checkbox()).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "DLsiteから取得 1件" }));
    expect(job.start).toHaveBeenCalledWith(["RJ000404"], true);

    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000404", { state: "fetching" }]]),
          progress: { processed: 0, total: 1 },
        },
      }));
    });
    expect(screen.getByText("取得中")).not.toBeNull();
    act(() => {
      job.setState((state) => ({ ...state, job: null }));
    });

    expect(screen.getByText("失敗")).not.toBeNull();
    expect(checkbox()).not.toBeChecked();
  });

  it("取得中は枠が進捗と中止に替わる", async () => {
    const { job } = await renderTab([first, second]);
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([
            ["RJ000001", { state: "fetching" }],
            ["RJ000002", { state: "queued" }],
          ]),
          progress: { processed: 0, total: 2 },
        },
      }));
    });
    expect(screen.getByRole("progressbar", { name: "DLsite取得の進捗" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "その他の操作" })).toBeNull();
    expect(screen.queryByRole("button", { name: /DLsiteから取得/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /件を追加/ })).toBeNull();
    expect(screen.getByRole("button", { name: "中止" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "中止" }));
    expect(job.cancel).toHaveBeenCalled();
  });

  it("アンマウント後に開き直しても、ストアの進捗がそのまま出る", async () => {
    const { job, unmount, store } = await renderTab([first]);
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000001", { state: "queued" }]]),
          progress: { processed: 0, total: 1 },
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
          createElement(UnregisteredTab, {
            candidates: [first],
            status: "ready",
            onRetry: () => {},
            onRegistered: vi.fn(),
          }),
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
  const openRowMenu = (title: string) =>
    fireEvent.click(screen.getByRole("button", { name: `「${title}」の操作` }));

  it("ツールバーに除外ボタンは無く、行のメニューから除外して元に戻せる", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    const restoreSpy = vi
      .spyOn(scanEntityApi, "restoreScanCandidateExclusions")
      .mockResolvedValue(undefined);
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue({
      scanCompleted: true,
      candidates: [],
    });
    await renderTab([candidateA, candidateB]);

    expect(screen.queryByRole("button", { name: "除外" })).toBeNull();
    openRowMenu(candidateA.inferredTitle);
    fireEvent.click(screen.getByRole("menuitem", { name: "除外" }));

    await waitFor(() =>
      expect(scanApi.excludeScanCandidates).toHaveBeenCalledWith([candidateA.path]),
    );
    await waitFor(() => expect(screen.getByText("「未検出作品」を除外しました")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith([candidateA.path]));
    await waitFor(() => expect(screen.queryByRole("button", { name: "元に戻す" })).toBeNull());
  });

  it("行のメニューの除外は、選択ではなくその行だけに効く", async () => {
    const spy = vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    await renderTab([candidateA, candidateB]);
    openRowMenu(candidateA.inferredTitle);
    fireEvent.click(screen.getByRole("menuitem", { name: "除外" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith([candidateA.path]));
  });

  it("絞り込み中の「すべて選択」と▾の「選択を除外」は表示中の行だけに効き、トーストは作品名と件数を出す", async () => {
    const problem = buildScanCandidate({
      path: "d/p",
      inferredTitle: "問題作品",
      rjCode: "RJ000404",
      dlsite: { state: "failed" },
    });
    const spy = vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    await renderTab([problem, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: /問題あり/ }));
    fireEvent.click(screen.getByLabelText("すべて選択"));
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "選択を除外" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith([problem.path]));
    await waitFor(() => expect(screen.getByText("「問題作品」を除外しました")).not.toBeNull());
  });

  it("複数を除外したトーストは「A」他N件で出す", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "選択を除外" }));
    await waitFor(() => expect(screen.getByText(/他1件を除外しました/)).not.toBeNull());
  });

  it("「除外済み N」から除外した候補の一覧を開き、行ごとに戻せる。0件なら出さない", async () => {
    const getSpy = vi
      .spyOn(scanEntityApi, "getScanCandidateExclusions")
      .mockResolvedValue(["dlsite/除外した作品", "dlsite/もう一つ"]);
    const restoreSpy = vi
      .spyOn(scanEntityApi, "restoreScanCandidateExclusions")
      .mockResolvedValue(undefined);
    await renderTab([candidateA]);

    fireEvent.click(await screen.findByRole("button", { name: /除外済み/ }));
    expect(screen.getByRole("list", { name: "除外済みの候補" })).not.toBeNull();
    getSpy.mockResolvedValue(["dlsite/もう一つ"]);
    fireEvent.click(screen.getByRole("button", { name: "「除外した作品」を未登録に戻す" }));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith(["dlsite/除外した作品"]));
    await waitFor(() => expect(screen.queryByText("除外した作品")).toBeNull());

    expect(screen.getByText("「除外した作品」を戻しました")).not.toBeNull();

    getSpy.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "「もう一つ」を未登録に戻す" }));
    await waitFor(() => expect(screen.getByText("除外した候補はありません")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "未登録" }));
    expect(screen.queryByRole("button", { name: /除外済み/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("すべて選択"));
  });

  it("除外済みの一覧を開くと「未登録」へフォーカスが移り、元の画面は操作できない。閉じると「除外済み N」へ戻る", async () => {
    vi.spyOn(scanEntityApi, "getScanCandidateExclusions").mockResolvedValue([
      "dlsite/除外した作品",
    ]);
    await renderTab([candidateA]);
    const trigger = await screen.findByRole("button", { name: /除外済み/ });
    trigger.focus();
    fireEvent.click(trigger);
    const back = screen.getByRole("button", { name: "未登録" });
    expect(document.activeElement).toBe(back);
    expect(screen.getByLabelText("すべて選択").closest("[inert]")).not.toBeNull();
    fireEvent.click(back);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /除外済み/ }));
  });

  it("最後の1件を戻したら、フォーカスは「未登録」ボタンへ移る", async () => {
    const getSpy = vi
      .spyOn(scanEntityApi, "getScanCandidateExclusions")
      .mockResolvedValue(["dlsite/除外した作品"]);
    vi.spyOn(scanEntityApi, "restoreScanCandidateExclusions").mockResolvedValue(undefined);
    await renderTab([candidateA]);
    fireEvent.click(await screen.findByRole("button", { name: /除外済み/ }));
    getSpy.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "「除外した作品」を未登録に戻す" }));
    await waitFor(() => expect(screen.getByText("除外した候補はありません")).not.toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "未登録" }));
  });

  it("フォーカスがメニューの外にあっても、Escはメニューだけを閉じて親のダイアログへ届かない", async () => {
    await renderTab([candidateA, candidateB]);
    const trigger = screen.getByRole("button", { name: `「${candidateA.inferredTitle}」の操作` });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    expect(screen.getByRole("menu")).not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(fireEvent.keyDown(document.body, { key: "Escape", isComposing: true })).toBe(true);
    expect(screen.getByRole("menu")).not.toBeNull();
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
  });

  it("行メニューはEscで閉じて︙へフォーカスが戻り、Tabで外へ出ても閉じる", async () => {
    await renderTab([candidateA, candidateB]);
    const trigger = screen.getByRole("button", { name: `「${candidateA.inferredTitle}」の操作` });
    fireEvent.click(trigger);
    const item = screen.getByRole("menuitem", { name: "除外" });
    item.focus();
    fireEvent.keyDown(item, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    screen.getByRole("menuitem", { name: "除外" }).focus();
    screen.getByLabelText("すべて選択").focus();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("行メニューの「フォルダーを開く」はその候補のパスでFilesを開く", async () => {
    const { onOpenFiles } = await renderTab([candidateA]);
    openRowMenu(candidateA.inferredTitle);
    fireEvent.click(screen.getByRole("menuitem", { name: "フォルダーを開く" }));
    expect(onOpenFiles).toHaveBeenCalledWith(candidateA.path);
  });

  it("除外が409（候補が古い）のときは、候補を取り直して選び直しを促す", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockRejectedValue(
      new ApiRequestError(409, "conflict", "stale"),
    );
    const refresh = vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue({
      scanCompleted: true,
      candidates: [],
    });
    await renderTab([candidateA]);
    openRowMenu(candidateA.inferredTitle);
    fireEvent.click(screen.getByRole("menuitem", { name: "除外" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("候補が更新されたため"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("候補が0件でも、除外済みがあれば「除外済み N」を出す", async () => {
    vi.spyOn(scanEntityApi, "getScanCandidateExclusions").mockResolvedValue([
      "dlsite/除外した作品",
    ]);
    await renderTab([]);
    expect(await screen.findByRole("button", { name: /除外済み/ })).not.toBeNull();
  });

  it("最後の候補を除外してタブが外れても、トーストの「元に戻す」は動き、失敗の表示は消えない", async () => {
    vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    const restoreSpy = vi
      .spyOn(scanEntityApi, "restoreScanCandidateExclusions")
      .mockRejectedValue(new Error("boom"));
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue({
      scanCompleted: true,
      candidates: [],
    });
    const { rerender } = await renderUnmountableTab([candidateA]);
    openRowMenu(candidateA.inferredTitle);
    fireEvent.click(screen.getByRole("menuitem", { name: "除外" }));
    await waitFor(() => expect(screen.getByText("「未検出作品」を除外しました")).not.toBeNull());

    rerender(false);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith([candidateA.path]));
    await waitFor(() => expect(screen.getByText("元に戻せませんでした")).not.toBeNull());
  });

  it("選択はatomに残り、外した候補は追加の対象にならない", async () => {
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [],
      interruptedBy: new Error("x"),
    });
    const { store } = await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));
    expect(store.get(scanCandidateSelectionAtom).get(candidateA.path)?.selected).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "1件を追加" }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([candidateB.path]);
  });
});

describe("UnregisteredTab 追加", () => {
  it("選択に取得中の行があるあいだは追加を出さず、選択から外すと追加できる", async () => {
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
    expect(screen.getByRole("button", { name: "DLsiteから取得 1件" })).not.toBeNull();
    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000001", { state: "fetching" }]]),
          progress: { processed: 0, total: 1 },
        },
      }));
    });
    expect(screen.queryByRole("button", { name: "その他の操作" })).toBeNull();
    expect(screen.queryByRole("button", { name: /DLsiteから取得/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /件を追加/ })).toBeNull();
    fireEvent.click(screen.getByLabelText(`「${fetching.inferredTitle}」を選択`));
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([candidateB.path, candidateA.path]);
  });

  it("未取得が選択にあれば主ボタンは取得で、▾の「取得せずに追加」で追加できる", async () => {
    const unfetched = buildScanCandidate({
      path: "d/u",
      inferredTitle: "未取得",
      rjCode: "RJ000002",
    });
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [],
      failures: [],
      interruptedBy: new Error("x"),
    });
    await renderTab([unfetched, candidateB]);
    expect(screen.queryByRole("button", { name: /件を追加/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    expect(screen.getByRole("menuitem", { name: "項目を選んで追加…" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "選択を除外" })).toBeEnabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "取得せずに追加" }));
    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    expect(registerSpy.mock.calls[0]?.[0]).toEqual([unfetched.path, candidateB.path]);
  });

  it("▾の「選択を除外」は選択中の行を除外する", async () => {
    const spy = vi.spyOn(scanApi, "excludeScanCandidates").mockResolvedValue(undefined);
    await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByLabelText(`「${candidateB.dlsite.title}」を選択`));
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "選択を除外" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith([candidateA.path]));
  });

  it("追加の対象にDLsite情報のない行が含まれると、その件数を出す。取得済みだけなら出さない", async () => {
    const fetchedRow = buildScanCandidate({
      path: "d/ok",
      inferredTitle: "取得済み作品",
      rjCode: "RJ000401",
      dlsite: { state: "fetched", title: "t", cover: null },
    });
    await renderTab([fetchedRow, candidateA]);
    expect(screen.getByText(/DLsite情報なし/)).not.toBeNull();
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));
    expect(screen.queryByText(/DLsite情報なし/)).toBeNull();
  });

  it("「うちDLsite情報なし N」を押すとその行に絞り込み、チェックを外しても行は消えない", async () => {
    const fetchedRow = buildScanCandidate({
      path: "d/ok",
      inferredTitle: "取得済み作品",
      rjCode: "RJ000401",
      dlsite: { state: "fetched", title: "t", cover: null },
    });
    await renderTab([fetchedRow, candidateA]);
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.queryByLabelText("「t」を選択")).toBeNull();
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));
    expect(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /DLsite情報なし/ }));
    expect(screen.getByLabelText("「t」を選択")).not.toBeNull();
  });

  it("フッターの左に選択の件数を出す", async () => {
    await renderTab([candidateA, candidateB]);
    expect(screen.getByText("件を選択").textContent).toBe("2件を選択");
    fireEvent.click(screen.getByLabelText(`「${candidateA.inferredTitle}」を選択`));
    expect(screen.getByText("件を選択").textContent).toBe("1件を選択");
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
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue({
      scanCompleted: true,
      candidates: [],
    });
    const { onRegistered } = await renderTab([candidateA, candidateB]);
    fireEvent.click(screen.getByRole("button", { name: "2件を追加" }));
    await waitFor(() =>
      expect(
        screen.getByText("候補が更新されたため表示を更新しました。選び直してください。"),
      ).not.toBeNull(),
    );
    expect(onRegistered).toHaveBeenCalledWith({
      registeredTitles: [candidateA.inferredTitle],
      coverSkippedTitles: [],
      failedCount: 0,
      remainingCount: 1,
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
      registeredTitles: [],
      coverSkippedTitles: [],
      failedCount: 0,
      remainingCount: 1,
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
      registeredTitles: [],
      coverSkippedTitles: [],
      failedCount: 1,
      remainingCount: 1,
      interrupted: false,
    });
  });

  it("追加した作品名と、カバーを適用できなかった作品名をonRegisteredへ渡す。タイトルを反映するなら取得済みのDLsiteタイトルを使う", async () => {
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
        registeredTitles: [candidateA.inferredTitle, "検出済みのDLsiteタイトル"],
        coverSkippedTitles: [candidateA.inferredTitle],
        failedCount: 0,
        remainingCount: 0,
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
      "GET /api/scan/candidates/exclusions": { paths: [] },
      "GET /api/scan/candidates": async () => {
        await refreshGate;
        return { scanCompleted: true, candidates: [candidateB] };
      },
    });
    const key = scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY;
    const { queryClient, rerenderWith } = await renderTab([candidateA, candidateB]);
    queryClient.setQueryData(key, { scanCompleted: true, candidates: [candidateA, candidateB] });
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      rerenderWith(queryClient.getQueryData<ScanCandidatesResponse>(key)?.candidates ?? []);
    });
    const addButton = () => screen.getByRole("button", { name: /件を追加/ });
    fireEvent.click(addButton());

    await waitFor(() => expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(1));
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(candidateA.inferredTitle)).toBeInTheDocument();

    releaseRefresh();
    await waitFor(() => expect(screen.queryByText(candidateA.inferredTitle)).toBeNull());
    await waitFor(() => expect(addButton()).toBeEnabled());
    unsubscribe();
  });

  it("追加リクエスト中にタブがアンマウントされても、候補が取り直されonRegisteredへ結果が届く", async () => {
    let resolveRegister!: (response: ScanCandidatesRegisterOutcome) => void;
    vi.spyOn(workApi, "registerScanCandidates").mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    const api = mockApi({
      "GET /api/scan/candidates/exclusions": { paths: [] },
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [candidateB] },
    });
    const { onRegistered, unmount, queryClient } = await renderTab([candidateA, candidateB]);
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [candidateA, candidateB],
    });
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
        registeredTitles: [candidateA.inferredTitle],
        coverSkippedTitles: [],
        failedCount: 1,
        remainingCount: 1,
        interrupted: false,
      }),
    );
    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(1);
    expect(queryClient.getQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY)).toEqual({
      scanCompleted: true,
      candidates: [candidateB],
    });
  });
});

describe("UnregisteredTab 終端表示", () => {
  it("終わったジョブがある状態で開いても候補を取り直さない", async () => {
    const refreshSpy = vi
      .spyOn(scanCandidatesCache, "refreshScanCandidates")
      .mockResolvedValue({ scanCompleted: true, candidates: [] });
    await renderTab([candidateB], {
      job: {
        jobId: "job-1",
        status: "finished" as const,
        codes: new Map(),
        progress: { processed: 0, total: 0 },
      },
    });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("候補を取り直さなくても、ジョブで見た終端の結果が候補より新しければ行に出す", async () => {
    const refreshSpy = vi
      .spyOn(scanCandidatesCache, "refreshScanCandidates")
      .mockResolvedValue({ scanCompleted: true, candidates: [] });
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
      "GET /api/scan/candidates/exclusions": { paths: [] },
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
    queryClient.setQueryData(scanCandidatesCache.SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [candidateA],
    });
    const store = createStore();
    store.set(dlsiteJobStoreAtom, createFakeDlsiteJobStore());
    function Connected() {
      return createElement(UnregisteredTab, {
        candidates: useScanCandidatesState().candidates,
        status: "ready",
        onRetry: () => {},
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
