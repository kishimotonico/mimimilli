import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Work } from "@mimimilli/shared";
import WorkGridInspector from "../../src/features/library/ui/WorkGridInspector";

vi.mock("../../src/features/library/ui/preview/WorkDetail", () => ({
  WorkDetail: ({ work }: { work: Work }) => <div data-testid="work-detail">{work.title}</div>,
}));

afterEach(cleanup);

function makeWork(): Work {
  return {
    id: "work-1",
    title: "作品1",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/works/work-1",
    totalDurationSec: 120,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    defaultPlaylistId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    playlists: [],
    resume: null,
  };
}

function renderInspector(props: Partial<React.ComponentProps<typeof WorkGridInspector>> = {}) {
  return render(
    <WorkGridInspector
      hasSelection={false}
      work={null}
      isLoading={false}
      isError={false}
      collectionStats={{ status: "loading" }}
      playingTrackIndex={null}
      tagSuggestions={[]}
      isPatching={false}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onResume={vi.fn()}
      onTogglePlay={vi.fn()}
      onTagClick={vi.fn()}
      onPatchWork={vi.fn()}
      {...props}
    />,
  );
}

describe("WorkGridInspector", () => {
  it("未選択時はコレクション概要（統計含む）を表示し、WorkDetail は描画しない", () => {
    renderInspector({
      hasSelection: false,
      collectionStats: { status: "ready", count: 42, trackCount: 87, durationSec: 45296 },
    });

    expect(screen.getByText("作品を選択してください")).toBeTruthy();
    expect(screen.getByText(/42作品/)).toBeTruthy();
    expect(screen.getByText(/87トラック/)).toBeTruthy();
    expect(screen.queryByTestId("work-detail")).toBeNull();
  });

  it("未選択時、統計がloadingなら統計行を出さない", () => {
    renderInspector({ hasSelection: false, collectionStats: { status: "loading" } });

    expect(screen.getByText("作品を選択してください")).toBeTruthy();
    expect(screen.queryByText(/作品 ·/)).toBeNull();
  });

  it("未選択時、統計取得がエラーなら案内を出す", () => {
    renderInspector({ hasSelection: false, collectionStats: { status: "error" } });

    expect(screen.getByText("統計の取得に失敗しました")).toBeTruthy();
  });

  it("選択中で work 取得済みなら WorkDetail を表示する", () => {
    renderInspector({ hasSelection: true, work: makeWork() });

    expect(screen.getByTestId("work-detail")).toBeTruthy();
    expect(screen.queryByText("作品を選択するとここに詳細が表示されます")).toBeNull();
  });

  it("選択中で読み込み中なら読み込み中を表示する", () => {
    renderInspector({ hasSelection: true, work: null, isLoading: true });

    expect(screen.getByText("読み込み中...")).toBeTruthy();
  });

  it("選択中でエラーならエラー文言と再試行ボタンを表示する", () => {
    const onRetry = vi.fn();
    renderInspector({ hasSelection: true, work: null, isError: true, onRetry });

    expect(screen.getByText("読み込みに失敗しました")).toBeTruthy();
    expect(screen.getByText("再試行")).toBeTruthy();
  });

  it("再試行ボタンで onRetry を呼ぶ", async () => {
    const onRetry = vi.fn();
    renderInspector({ hasSelection: true, work: null, isError: true, onRetry });

    await userEvent.click(screen.getByText("再試行"));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("閉じるボタンで onClose を呼ぶ", async () => {
    const onClose = vi.fn();
    renderInspector({ onClose });

    await userEvent.click(screen.getByLabelText("パネルを閉じる"));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
