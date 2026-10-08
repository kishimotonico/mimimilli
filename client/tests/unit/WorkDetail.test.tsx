// WorkDetail が playingTrackIndex/isPlaybackActive から isLoaded/isPlaying を
// 正しく導出し、WorkPlayButton（延いてはWorkMetadataActions）へ伝えていることを
// 確認する。重いサブコンポーネント（タグ編集・トラック一覧等）はモック化し、
// 再生ボタンまわりの配線だけを検証する。
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WorkDetail } from "../../src/features/library/ui/preview/WorkDetail";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";

const { playWork, resumeWork, togglePlay } = vi.hoisted(() => ({
  playWork: vi.fn(),
  resumeWork: vi.fn(),
  togglePlay: vi.fn(),
}));

vi.mock("../../src/entities/player/model/usePlayWork", () => ({
  usePlayWork: () => ({ playWork, resumeWork }),
}));
vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ playFile: vi.fn(), togglePlay }),
}));

vi.mock("../../src/features/library/ui/preview/WorkTagEditor", () => ({
  WorkTagEditor: () => <div data-testid="tag-editor" />,
}));
vi.mock("../../src/features/library/ui/preview/WorkTrackList", () => ({
  WorkTrackList: ({ onPlay }: { onPlay: (trackIndex: number) => void }) => (
    <button type="button" data-testid="track-list" onClick={() => onPlay(2)}>
      トラック
    </button>
  ),
}));
vi.mock("../../src/features/library/ui/preview/WorkStatusWarnings", () => ({
  WorkStatusWarnings: () => null,
}));
vi.mock("../../src/entities/settings/useSettingsQuery", () => ({
  useRootFolder: () => "/library",
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
    editMutation: noopMutation,
    bookmarkMutation: noopMutation,
    addTagMutation: noopMutation,
    removeTagMutation: noopMutation,
  };
}

function makeDeleteMutationStub(
  overrides: Partial<{ mutateAsync: ReturnType<typeof vi.fn> }> = {},
) {
  return {
    isPending: false,
    error: null,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as unknown as React.ComponentProps<typeof WorkDetail>["deleteMutation"];
}

function renderDetail(props: Partial<React.ComponentProps<typeof WorkDetail>> = {}) {
  return render(
    <WorkDetail
      work={makeWork()}
      playingTrackIndex={null}
      isPlaybackActive={false}
      tagSuggestions={[]}
      workPatchMutations={makeWorkPatchMutationsStub()}
      deleteMutation={makeDeleteMutationStub()}
      onUnregistered={vi.fn()}
      onTagClick={vi.fn()}
      {...props}
    />,
  );
}

describe("WorkDetail: 再生ボタンの状態導出", () => {
  it("履歴なし・非ロード（playingTrackIndex=null）: 「最初から再生」", () => {
    renderDetail({ work: makeWork({ resume: null }), playingTrackIndex: null });
    expect(screen.getByRole("button", { name: "最初から再生" })).toBeInTheDocument();
  });

  it("履歴あり・非ロード: 「続きから再生」", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 30 } });
    renderDetail({ work, playingTrackIndex: null });
    expect(screen.getByRole("button", { name: "続きから再生" })).toBeInTheDocument();
  });

  it("playingTrackIndexが非null かつ isPlaybackActive=true: 「一時停止」（再生中）", () => {
    renderDetail({ playingTrackIndex: 0, isPlaybackActive: true });
    expect(screen.getByRole("button", { name: "一時停止" })).toBeInTheDocument();
  });

  it("playingTrackIndexが非null だが isPlaybackActive=false: 「再生を再開」（一時停止中、ロード済み）", () => {
    renderDetail({ playingTrackIndex: 0, isPlaybackActive: false });
    expect(screen.getByRole("button", { name: "再生を再開" })).toBeInTheDocument();
  });

  it("履歴があるときだけカバーに進捗バーを表示する（role=progressbar）", () => {
    const withResume = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 50 } });
    renderDetail({ work: withResume, playingTrackIndex: null });
    expect(screen.getByRole("progressbar", { name: "再開位置" })).toBeInTheDocument();

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

describe("WorkDetail: 作品登録の解除", () => {
  it("その他メニューから解除を選び確認ダイアログで解除するとmutation.mutateAsyncを呼ぶ", () => {
    const mutateAsync = vi.fn(() => new Promise<void>(() => {}));
    renderDetail({ deleteMutation: makeDeleteMutationStub({ mutateAsync }) });

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "作品登録を解除" }));
    expect(screen.getByRole("alertdialog", { name: "登録を解除" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "解除する" }));
    expect(mutateAsync).toHaveBeenCalledWith("w1");
  });

  it("確認ダイアログをキャンセルするとmutation.mutateAsyncを呼ばない", () => {
    const mutateAsync = vi.fn();
    renderDetail({ deleteMutation: makeDeleteMutationStub({ mutateAsync }) });

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "作品登録を解除" }));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("解除に成功するとuseToast経由でsuccessトーストの表示要求を出し、onUnregisteredを呼ぶ", async () => {
    const mutateAsync = vi.fn(async () => {});
    const onUnregistered = vi.fn();
    const store = getDefaultStore();
    renderDetail({
      work: makeWork({ title: "作品X" }),
      deleteMutation: makeDeleteMutationStub({ mutateAsync }),
      onUnregistered,
    });

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "作品登録を解除" }));
    fireEvent.click(screen.getByRole("button", { name: "解除する" }));

    await waitFor(() => expect(onUnregistered).toHaveBeenCalledTimes(1));
    const requests = [...store.get(toastRequestsAtom).values()];
    expect(requests).toContainEqual(
      expect.objectContaining({
        message: "「作品X」の登録を解除しました",
        variant: "success",
      }),
    );
  });

  it("解除に成功すれば、WorkDetailがアンマウント済みでもトーストとonUnregisteredが届く", async () => {
    let resolveDelete!: () => void;
    const mutateAsync = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const onUnregistered = vi.fn();
    const store = getDefaultStore();
    const view = renderDetail({
      work: makeWork({ title: "作品Y" }),
      deleteMutation: makeDeleteMutationStub({ mutateAsync }),
      onUnregistered,
    });

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "作品登録を解除" }));
    fireEvent.click(screen.getByRole("button", { name: "解除する" }));
    view.unmount();
    resolveDelete();

    await waitFor(() => expect(onUnregistered).toHaveBeenCalledTimes(1));
    expect([...store.get(toastRequestsAtom).values()]).toContainEqual(
      expect.objectContaining({ message: "「作品Y」の登録を解除しました" }),
    );
  });
});

describe("WorkDetail: 再生操作の配線", () => {
  it("「最初から再生」はplayWork(作品, 0)を呼ぶ", () => {
    renderDetail({ work: makeWork({ resume: null }) });
    fireEvent.click(screen.getByRole("button", { name: "最初から再生" }));
    expect(playWork).toHaveBeenCalledWith(expect.objectContaining({ id: "w1" }), 0);
  });

  it("トラック一覧で選んだトラックはplayWork(作品, trackIndex)に渡る", () => {
    renderDetail();
    fireEvent.click(screen.getByTestId("track-list"));
    expect(playWork).toHaveBeenCalledWith(expect.objectContaining({ id: "w1" }), 2);
  });

  it("「続きから再生」はresumeWork(work)を呼ぶ", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 30 } });
    renderDetail({ work });
    fireEvent.click(screen.getByRole("button", { name: "続きから再生" }));
    expect(resumeWork).toHaveBeenCalledWith(work);
    expect(playWork).not.toHaveBeenCalled();
  });

  it("ロード済みのときの主ボタンはtogglePlayを呼び、新規再生は始めない", () => {
    renderDetail({ playingTrackIndex: 0, isPlaybackActive: true });
    fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(playWork).not.toHaveBeenCalled();
    expect(resumeWork).not.toHaveBeenCalled();
  });
});
