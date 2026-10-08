import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveResumePosition } from "../../src/features/player/api";
import { useResumePersistenceController } from "../../src/features/player/model/useResumePersistence";
import type { PendingResume } from "../../src/entities/player/model/playerRuntime";
import { PlayerController } from "../../src/entities/player/model/playerController";
import type { Track, Work, WorkSummary } from "../../src/entities/work/model";

vi.mock("../../src/features/player/api", () => ({
  saveResumePosition: vi.fn(() => Promise.resolve()),
}));

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const track: Track = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Track",
  file: "track.wav",
};

const pendingResumeRef = { current: null as PendingResume | null };

function loadedController() {
  const controller = new PlayerController();
  controller.dispatch({
    type: "startRequested",
    item: {
      source: { kind: "work", work: { id: "work-1" } as WorkSummary },
      playlistId,
      tracks: [track],
      trackIndex: 0,
      completionScope: "work",
    },
  });
  return controller;
}

function options() {
  return { engineRef: { current: null }, controller: loadedController(), pendingResumeRef };
}

beforeEach(() => {
  vi.mocked(saveResumePosition).mockReset();
  vi.mocked(saveResumePosition).mockResolvedValue(undefined);
});

describe("resume persistence port", () => {
  it("レジュームをController向けのtrack indexと相対位置へ解決する", () => {
    const work = {
      id: "work-1",
      defaultPlaylistId: playlistId,
      playlists: [{ id: playlistId, name: "default", tracks: [track] }],
      resume: { playlistId, trackId: track.id, offsetSec: 15 },
    } as Work;
    const { result } = renderHook(() => useResumePersistenceController(options()));

    expect(result.current.loadResume(work)).toEqual({
      playlistId,
      tracks: [track],
      trackIndex: 0,
      positionSec: 15,
    });
  });

  it("resumeのtrackを解決できない場合はdefault playlistの先頭を返す", () => {
    const work = {
      id: "work-1",
      defaultPlaylistId: playlistId,
      playlists: [{ id: playlistId, name: "default", tracks: [track] }],
      resume: { playlistId, trackId: "missing-track", offsetSec: 15 },
    } as Work;
    const { result } = renderHook(() => useResumePersistenceController(options()));

    expect(result.current.loadResume(work)).toEqual({
      playlistId,
      tracks: [track],
      trackIndex: 0,
      positionSec: 0,
    });
  });

  it("飛行中の保存後に次の保存を直列化し、先行保存の失敗後も継続する", async () => {
    let rejectFirstSave: ((reason?: unknown) => void) | undefined;
    vi.mocked(saveResumePosition)
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirstSave = reject;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useResumePersistenceController(options()));

    act(() => {
      result.current.saveCurrentResume(75);
      result.current.enqueueResumeSave("work-1", {
        playlistId,
        trackId: track.id,
        offsetSec: 0,
      });
    });
    expect(saveResumePosition).toHaveBeenCalledTimes(1);

    act(() => rejectFirstSave?.(new Error("保存失敗")));
    await waitFor(() => expect(saveResumePosition).toHaveBeenCalledTimes(2));
    expect(saveResumePosition).toHaveBeenLastCalledWith("work-1", {
      playlistId,
      trackId: track.id,
      offsetSec: 0,
    });
  });
});
