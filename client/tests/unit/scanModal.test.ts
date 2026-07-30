// ScanModal のEsc/backdrop挙動（TASK-56: NewWorkPopupの統合先）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanJobSnapshot, ScanResult, Work } from "@mimimilli/shared";
import ScanModal from "../../src/features/scan/ui/ScanModal";
import * as workApi from "../../src/entities/work/api";
import { scanActionsAtom, scanJobAtom } from "../../src/features/scan/model/atoms";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const work: Work = {
  id: "work-1",
  title: "新規作品",
  cover: null,
  status: "ok",
  physicalPath: "/audio/work-1",
  totalDurationSec: 120,
  addedAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
  urls: [],
  tags: [],
  trackCount: 1,
  bookmarked: false,
  lastPlayedAt: null,
  dlsite: { rjCode: null, status: "none", lastAttemptAt: null, error: null, appliedTags: [] },
  defaultPlaylistId: null,
  createdAt: null,
  playlists: [],
  resume: null,
};

const scanResult: ScanResult = {
  registered: 10,
  newlyGenerated: 1,
  errors: 0,
  missing: 0,
  newWorkIds: [work.id],
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
};

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

function createRunningJob(
  progress: ScanJobSnapshot["progress"] = { phase: "registering", processed: 3, total: 12 },
): ScanJobSnapshot {
  return {
    id: "job-1",
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: null,
    progress,
    result: null,
    error: null,
  };
}

function renderModal(
  overrides: Partial<Parameters<typeof ScanModal>[0]> = {},
  scanState: { job?: ScanJobSnapshot | null } = {},
) {
  const store = createStore();
  const onStart = vi.fn();
  const onCancel = vi.fn();
  store.set(scanActionsAtom, {
    start: onStart.mockResolvedValue(undefined),
    cancel: onCancel.mockResolvedValue(undefined),
    clearError: vi.fn(),
  });
  if (scanState.job !== undefined) {
    store.set(scanJobAtom, scanState.job);
  }

  const modalProps = {
    lastResult: scanResult,
    lastScanTime: null,
    libraryTotal: 11,
    onClose: vi.fn(),
    onOpenRjCodeMissing: vi.fn(),
    ...overrides,
  };

  const view = render(
    createElement(JotaiProvider, { store }, createElement(ScanModal, modalProps)),
  );

  const rerenderModal = (newOverrides: Partial<Parameters<typeof ScanModal>[0]> = {}) => {
    view.rerender(
      createElement(
        JotaiProvider,
        { store },
        createElement(ScanModal, { ...modalProps, ...newOverrides }),
      ),
    );
  };

  return { ...view, store, onStart, onCancel, rerenderModal };
}

describe("ScanModal", () => {
  it("タイトル編集中のEscapeは編集だけをキャンセルし、モーダルは閉じない", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));

    const input = screen.getByDisplayValue(work.title);
    expect(input).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "スキャン" });
    dispatchCancel(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue(work.title)).toBeNull();
    expect(screen.getByText(work.title)).toBeInTheDocument();
  });

  it("編集中でないときのEscapeはモーダルを閉じる", () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    renderModal({ onClose });

    const dialog = screen.getByRole("dialog", { name: "スキャン" });
    dispatchCancel(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdropクリックは編集中でも問答無用でモーダルを閉じる（既存挙動を維持）", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));
    expect(screen.getByDisplayValue(work.title)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "スキャン" });
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("パネル内側のクリックではモーダルを閉じない", () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("heading", { name: "スキャン" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("実行中はフェーズと進捗を表示し、直前の統計は残したまま中止ボタンを表示する", () => {
    const onClose = vi.fn();
    const { onCancel } = renderModal(
      { onClose },
      {
        job: createRunningJob({ phase: "registering", processed: 3, total: 12 }),
      },
    );

    expect(screen.getByRole("dialog", { name: "スキャン" })).toBeInTheDocument();
    expect(screen.getByText("作品を登録中")).toBeInTheDocument();
    expect(screen.getByText("3/12")).toBeInTheDocument();
    // 実行中も統計バッジは直前の値のまま表示され続ける（画面が切り替わったように見せない）
    expect(screen.getByText(String(scanResult.registered))).toBeInTheDocument();

    // 閉じるは常設のヘッダーアイコンで、バックグラウンド継続の案内文だけが実行中に出る
    expect(screen.getByText("閉じてもバックグラウンドで続行します")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "スキャンを中止" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("前回結果が無ければ統計は未計測（—）のままスキャン開始ボタンを表示する", () => {
    const { onStart } = renderModal({ lastResult: null });

    // 「今回のスキャン」の4枠は未計測、ライブラリ全体の件数は別枠で表示される
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getByText("ライブラリ全体")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("蔵書が0件でも「今回のスキャン」が全て0とライブラリ全体の0件は別枠で区別される", () => {
    renderModal({
      lastResult: { ...scanResult, registered: 0, newlyGenerated: 0, newWorkIds: [] },
      libraryTotal: 0,
    });

    expect(screen.getByText("ライブラリ全体")).toBeInTheDocument();
    // ライブラリ全体の0件と「今回のスキャン」の登録済み0件が同じ「0」でも別要素として存在する
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
  });

  it("実行中から完了への遷移を見ていたときだけ、完了サインと変化した統計の強調が一時的に出る", async () => {
    const before: ScanResult = { ...scanResult, registered: 5, newlyGenerated: 0 };
    const after: ScanResult = { ...scanResult, registered: 6, newlyGenerated: 1 };
    const { store, rerenderModal } = renderModal(
      { lastResult: before },
      { job: createRunningJob({ phase: "registering", processed: 1, total: 1 }) },
    );

    act(() => {
      store.set(scanJobAtom, null);
      rerenderModal({ lastResult: after, lastScanTime: "2026-01-01T00:00:00.000Z" });
    });

    // AnimatePresence(mode="wait")のexit→enterはrequestAnimationFrame駆動のため実時間で待つ
    await waitFor(() => expect(screen.getByText("完了しました")).toBeInTheDocument());
    // 変化した「登録済み」の値は強調用の背景クラスが付く
    const registeredValue = screen.getByText("6");
    expect(registeredValue.parentElement?.className).toContain("bg-[color-mix");

    // レイアウトは動かさず、時間経過で最終スキャン表示と通常の枠色に自然に戻る
    await waitFor(
      () => {
        expect(screen.queryByText("完了しました")).toBeNull();
        expect(screen.getByText(/最終スキャン/)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(registeredValue.parentElement?.className).not.toContain("bg-[color-mix");
  }, 6000);

  it("newWorkIdsが変わったら一覧をクリアし、取得失敗時は古い一覧を残さない", async () => {
    const workA: Work = { ...work, id: "work-a", title: "作品A" };
    const workB: Work = { ...work, id: "work-b", title: "作品B" };
    const getWorkSpy = vi.spyOn(workApi, "getWork");
    getWorkSpy.mockResolvedValueOnce(workA);

    const { rerenderModal } = renderModal({
      lastResult: { ...scanResult, newWorkIds: [workA.id] },
    });
    await waitFor(() => screen.getByText(workA.title));

    getWorkSpy.mockRejectedValueOnce(new Error("fetch failed"));
    rerenderModal({ lastResult: { ...scanResult, newWorkIds: [workB.id] } });

    await waitFor(() =>
      expect(screen.getByText("新規作品の読み込みに失敗しました")).toBeInTheDocument(),
    );
    expect(screen.queryByText(workA.title)).toBeNull();
  });

  it("遅延した前回リクエストは新しいnewWorkIdsの結果を上書きしない", async () => {
    const workA: Work = { ...work, id: "work-a", title: "作品A" };
    const workB: Work = { ...work, id: "work-b", title: "作品B" };
    let resolveA: (value: Work) => void = () => {};
    let resolveB: (value: Work) => void = () => {};
    const getWorkSpy = vi.spyOn(workApi, "getWork");
    getWorkSpy.mockImplementation((id) => {
      if (id === workA.id) {
        return new Promise<Work>((resolve) => {
          resolveA = resolve;
        });
      }
      return new Promise<Work>((resolve) => {
        resolveB = resolve;
      });
    });

    const { rerenderModal } = renderModal({
      lastResult: { ...scanResult, newWorkIds: [workA.id] },
    });

    rerenderModal({ lastResult: { ...scanResult, newWorkIds: [workB.id] } });

    resolveB(workB);
    await waitFor(() => screen.getByText(workB.title));

    resolveA(workA);
    await waitFor(() => expect(screen.queryByText(workA.title)).toBeNull());
    expect(screen.getByText(workB.title)).toBeInTheDocument();
  });

  it("タイトル保存に失敗したときエラーを表示し、ローカル表示は更新されない", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    vi.spyOn(workApi, "patchWork").mockRejectedValue(new Error("network error"));
    renderModal();

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));
    const input = screen.getByDisplayValue(work.title);
    fireEvent.change(input, { target: { value: "新しいタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByText("タイトルの保存に失敗しました")).toBeInTheDocument(),
    );
    // 失敗時はローカルの表示名を更新せず、入力欄は編集状態のまま残る（再試行可能）
    expect(screen.getByDisplayValue("新しいタイトル")).toBeInTheDocument();
    expect(screen.queryByText(work.title)).toBeNull();
  });

  it("タイトル保存に成功したとき表示名が更新され編集モードが閉じる", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    vi.spyOn(workApi, "patchWork").mockResolvedValue({ ...work, title: "新しいタイトル" });
    renderModal();

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));
    const input = screen.getByDisplayValue(work.title);
    fireEvent.change(input, { target: { value: "新しいタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("新しいタイトル")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("新しいタイトル")).toBeNull();
  });

  it("空文字・空白のみのタイトルは保存されず編集モードだけ閉じる", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const patchSpy = vi.spyOn(workApi, "patchWork");
    renderModal();

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));
    const input = screen.getByDisplayValue(work.title);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(patchSpy).not.toHaveBeenCalled();
    expect(screen.getByText(work.title)).toBeInTheDocument();
  });
});
