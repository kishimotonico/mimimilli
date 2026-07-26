// ScanModal のEsc/backdrop挙動（TASK-56: NewWorkPopupの統合先）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult, Work } from "@mimimilli/shared";
import ScanModal from "../../src/features/scan/ui/ScanModal";
import * as workApi from "../../src/entities/work/api";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
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

function renderModal(overrides: Partial<Parameters<typeof ScanModal>[0]> = {}) {
  return render(
    createElement(ScanModal, {
      scanning: false,
      progress: null,
      lastResult: scanResult,
      lastScanTime: null,
      onStart: vi.fn(),
      onCancel: vi.fn(),
      onClose: vi.fn(),
      onOpenRjCodeMissing: vi.fn(),
      ...overrides,
    }),
  );
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

  it("実行中はフェーズ別進捗と中止ボタンを表示し、閉じてもonCancelは呼ばれない", () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    renderModal({
      scanning: true,
      progress: { phase: "registering", processed: 3, total: 12 },
      onCancel,
      onClose,
    });

    expect(screen.getByRole("dialog", { name: "スキャン" })).toBeInTheDocument();
    expect(screen.getByText("作品を登録中")).toBeInTheDocument();
    expect(screen.getByText("3/12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "閉じる（バックグラウンドで継続）" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "スキャンを中止" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("前回結果が無ければ未実行の案内とスキャン開始ボタンを表示する", () => {
    const onStart = vi.fn();
    renderModal({ lastResult: null, onStart });

    expect(screen.getByText("まだスキャンを実行していません")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
