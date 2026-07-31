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
      summary={{ label: "作品", count: 0 }}
      playingTrackIndex={null}
      tagSuggestions={[]}
      isPatching={false}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onResume={vi.fn()}
      onPatchWork={vi.fn()}
      {...props}
    />,
  );
}

describe("WorkGridInspector", () => {
  it("未選択時はコレクション概要を表示し、WorkDetail は描画しない", () => {
    renderInspector({ hasSelection: false, summary: { label: "サークル一覧", count: 42 } });

    expect(screen.getByText("42 件")).toBeTruthy();
    expect(screen.getByText("サークル一覧")).toBeTruthy();
    expect(screen.getByText("作品を選択するとここに詳細が表示されます")).toBeTruthy();
    expect(screen.queryByTestId("work-detail")).toBeNull();
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

  it("選択中でエラーならエラー文言を表示する", () => {
    renderInspector({ hasSelection: true, work: null, isError: true });

    expect(screen.getByText("詳細の読み込みに失敗しました")).toBeTruthy();
  });

  it("閉じるボタンで onClose を呼ぶ", async () => {
    const onClose = vi.fn();
    renderInspector({ onClose });

    await userEvent.click(screen.getByLabelText("パネルを閉じる"));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
