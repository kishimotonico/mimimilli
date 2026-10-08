import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { usePlayWork } from "../../src/entities/player/model/usePlayWork";

import { mockApi } from "../helpers/api";
import { buildResolvedPlaylist, buildWork, buildWorkListItem } from "../helpers/builders";

const { play, playWithResume } = vi.hoisted(() => ({
  play: vi.fn(),
  playWithResume: vi.fn(),
}));

vi.mock("../../src/entities/work/model/workCacheUpdates", () => ({
  updateCachesAfterPlaybackPrepared: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ play, playWithResume }),
}));

const listItem = buildWorkListItem({ id: "w1" });

function preparedWork(): Work {
  const playlists = [buildResolvedPlaylist(1, ["a"]), buildResolvedPlaylist(2, ["b", "c"])];
  return buildWork({ id: "w1", defaultPlaylistId: playlists[1]!.id, playlists });
}

let prepared: Work;

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(PlayerRuntimeProvider, null, children),
    );
  return renderHook(() => usePlayWork(), { wrapper }).result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  prepared = preparedWork();
  mockApi({ "POST /api/works/:id/playback-preparation": () => prepared });
});

describe("usePlayWork", () => {
  it("playWorkは既定プレイリストのトラックでplayを呼ぶ", async () => {
    await setup().playWork(listItem, 1);
    const [defaultPlaylist] = prepared.playlists.filter(
      (playlist) => playlist.id === prepared.defaultPlaylistId,
    );
    expect(play).toHaveBeenCalledWith(
      listItem,
      defaultPlaylist!.tracks,
      1,
      prepared.defaultPlaylistId,
    );
  });

  it("trackIndexはトラック数の末尾に丸める", async () => {
    await setup().playWork(listItem, 99);
    expect(play).toHaveBeenCalledWith(listItem, expect.any(Array), 1, prepared.defaultPlaylistId);
  });

  it("resumeWorkは準備済みの作品でplayWithResumeを呼ぶ", async () => {
    await setup().resumeWork(buildWork({ id: "w1" }));
    expect(playWithResume).toHaveBeenCalledWith(prepared);
    expect(play).not.toHaveBeenCalled();
  });
});
