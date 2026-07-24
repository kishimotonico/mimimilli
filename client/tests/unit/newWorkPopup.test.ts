// NewWorkPopup のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult, Work } from "@mimimilli/shared";
import NewWorkPopup from "../../src/features/scan/ui/NewWorkPopup";
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
};

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

describe("NewWorkPopup", () => {
  it("タイトル編集中のEscapeは編集だけをキャンセルし、ポップアップは閉じない", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    render(createElement(NewWorkPopup, { scanResult, onClose, onOpenRjCodeMissing: vi.fn() }));

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));

    const input = screen.getByDisplayValue(work.title);
    expect(input).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "スキャン完了" });
    dispatchCancel(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue(work.title)).toBeNull();
    expect(screen.getByText(work.title)).toBeInTheDocument();
  });

  it("編集中でないときのEscapeはポップアップを閉じる", () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    render(createElement(NewWorkPopup, { scanResult, onClose, onOpenRjCodeMissing: vi.fn() }));

    const dialog = screen.getByRole("dialog", { name: "スキャン完了" });
    dispatchCancel(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdropクリックは編集中でも問答無用でポップアップを閉じる（既存挙動を維持）", async () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    render(createElement(NewWorkPopup, { scanResult, onClose, onOpenRjCodeMissing: vi.fn() }));

    await waitFor(() => screen.getByText(work.title));
    fireEvent.click(screen.getByText(work.title));
    expect(screen.getByDisplayValue(work.title)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "スキャン完了" });
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("パネル内側のクリックではポップアップを閉じない", () => {
    vi.spyOn(workApi, "getWork").mockResolvedValue(work);
    const onClose = vi.fn();
    render(createElement(NewWorkPopup, { scanResult, onClose, onOpenRjCodeMissing: vi.fn() }));

    fireEvent.click(screen.getByRole("heading", { name: "スキャン完了" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
