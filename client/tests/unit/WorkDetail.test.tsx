// WorkDetail が playingTrackIndex/isPlaybackActive から isLoaded/isPlaying を
// 正しく導出し、WorkPlayButton（延いてはWorkMetadataActions）へ伝えていることを
// 確認する。重いサブコンポーネント（タグ編集・トラック一覧等）はモック化し、
// 再生ボタンまわりの配線だけを検証する。
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WorkDetail } from "../../src/features/library/ui/preview/WorkDetail";

vi.mock("../../src/features/library/ui/preview/WorkTagEditor", () => ({
  WorkTagEditor: () => <div data-testid="tag-editor" />,
}));
vi.mock("../../src/features/library/ui/preview/WorkTrackList", () => ({
  WorkTrackList: () => <div data-testid="track-list" />,
}));
vi.mock("../../src/features/library/ui/preview/WorkStatusWarnings", () => ({
  WorkStatusWarnings: () => null,
}));

afterEach(cleanup);

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 200,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          { id: "t1", title: "1", file: "1.mp3", durationSec: 100, durationKind: "resolved" },
          { id: "t2", title: "2", file: "2.mp3", durationSec: 100, durationKind: "resolved" },
        ],
      },
    ],
    resume: null,
    ...overrides,
  };
}

function makeWorkPatchMutationsStub() {
  const noopMutation = {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  };
  return {
    titleMutation: noopMutation,
    bookmarkMutation: noopMutation,
    tagsMutation: noopMutation,
  };
}

function renderDetail(props: Partial<React.ComponentProps<typeof WorkDetail>> = {}) {
  return render(
    <WorkDetail
      work={makeWork()}
      onPlay={vi.fn()}
      onResume={vi.fn()}
      onTogglePlay={vi.fn()}
      playingTrackIndex={null}
      isPlaybackActive={false}
      tagSuggestions={[]}
      workPatchMutations={makeWorkPatchMutationsStub()}
      onTagClick={vi.fn()}
      {...props}
    />,
  );
}

describe("WorkDetail: 再生ボタンの状態導出", () => {
  it("履歴なし・非ロード（playingTrackIndex=null）: 「最初から再生」", () => {
    renderDetail({ work: makeWork({ resume: null }), playingTrackIndex: null });
    expect(screen.getByRole("button", { name: "最初から再生" })).toBeTruthy();
  });

  it("履歴あり・非ロード: 「続きから再生」", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 30 } });
    renderDetail({ work, playingTrackIndex: null });
    expect(screen.getByRole("button", { name: "続きから再生" })).toBeTruthy();
  });

  it("playingTrackIndexが非null かつ isPlaybackActive=true: 「一時停止」（再生中）", () => {
    renderDetail({ playingTrackIndex: 0, isPlaybackActive: true });
    expect(screen.getByRole("button", { name: "一時停止" })).toBeTruthy();
  });

  it("playingTrackIndexが非null だが isPlaybackActive=false: 「再生を再開」（一時停止中、ロード済み）", () => {
    renderDetail({ playingTrackIndex: 0, isPlaybackActive: false });
    expect(screen.getByRole("button", { name: "再生を再開" })).toBeTruthy();
  });

  it("履歴があるときだけカバーに進捗バーを表示する（role=progressbar）", () => {
    const withResume = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 50 } });
    renderDetail({ work: withResume, playingTrackIndex: null });
    expect(screen.getByRole("progressbar", { name: "再開位置" })).toBeTruthy();

    cleanup();
    renderDetail({ work: makeWork({ resume: null }), playingTrackIndex: null });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("進捗割合が極小でもaria-valuenowは丸めた実割合のまま（表示幅の最小保証とは独立）", () => {
    // offsetSec=1 / totalDurationSec相当=200 → 実割合は0.5%。表示上の最小幅保証
    // （resumeProgressBarWidth）はaria値に影響しないことをここで確認する。
    // 実際の最小幅ロジック自体はresumeProgress.test.tsで検証する。
    const work = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 1 } });
    renderDetail({ work, playingTrackIndex: null });
    const bar = screen.getByRole("progressbar", { name: "再開位置" });
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
  });
});
