import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useResumePersistenceController } from "../../src/features/player/model/useResumePersistence";
import type { PendingResume } from "../../src/entities/player/model/playerRuntime";
import { PlayerController } from "../../src/entities/player/model/playerController";
import type { Track, Work, WorkSummary } from "../../src/entities/work/model";
import { apiNoContent, mockApi, type ApiMock } from "../helpers/api";

const RESUME_ROUTE = "POST /api/works/:id/resume";
let api: ApiMock;

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
  api = mockApi({ [RESUME_ROUTE]: () => apiNoContent() });
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
    let saveCount = 0;
    api = mockApi({
      [RESUME_ROUTE]: () => {
        saveCount += 1;
        if (saveCount > 1) return apiNoContent();
        return new Promise<Response>((_resolve, reject) => {
          rejectFirstSave = reject;
        });
      },
    });
    const { result } = renderHook(() => useResumePersistenceController(options()));

    act(() => {
      result.current.saveCurrentResume(75);
      result.current.enqueueResumeSave("work-1", {
        playlistId,
        trackId: track.id,
        offsetSec: 0,
      });
    });
    expect(api.requestsTo(RESUME_ROUTE)).toHaveLength(1);

    act(() => rejectFirstSave?.(new Error("保存失敗")));
    await waitFor(() => expect(api.requestsTo(RESUME_ROUTE)).toHaveLength(2));
    const lastSave = api.requestsTo(RESUME_ROUTE)[1];
    expect(lastSave?.params.id).toBe("work-1");
    expect(lastSave?.body).toEqual({ playlistId, trackId: track.id, offsetSec: 0 });
  });
});
