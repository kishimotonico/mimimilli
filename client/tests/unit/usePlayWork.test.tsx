import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work, WorkListItem } from "@mimimilli/shared";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { usePlayWork } from "../../src/entities/player/model/usePlayWork";

const { prepareWorkPlayback, play, playWithResume } = vi.hoisted(() => ({
  prepareWorkPlayback: vi.fn(),
  play: vi.fn(),
  playWithResume: vi.fn(),
}));

vi.mock("../../src/entities/work/api", () => ({ prepareWorkPlayback }));
vi.mock("../../src/entities/work/model/workCacheUpdates", () => ({
  updateCachesAfterPlaybackPrepared: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ play, playWithResume }),
}));

const tracksOf = (...ids: string[]) =>
  ids.map((id) => ({ id, title: id, file: `${id}.wav`, start: 0, end: 10 }));

const listItem = { id: "w1", status: "ok" } as unknown as WorkListItem;

function preparedWork(): Work {
  return {
    id: "w1",
    status: "ok",
    defaultPlaylistId: "p2",
    playlists: [
      { id: "p1", tracks: tracksOf("a") },
      { id: "p2", tracks: tracksOf("b", "c") },
    ],
  } as unknown as Work;
}

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
  prepareWorkPlayback.mockResolvedValue(preparedWork());
});

describe("usePlayWork", () => {
  it("playWorkは既定プレイリストのトラックでplayを呼ぶ", async () => {
    await setup().playWork(listItem, 1);
    const prepared = await prepareWorkPlayback.mock.results[0]!.value;
    expect(play).toHaveBeenCalledWith(listItem, prepared.playlists[1].tracks, 1, "p2");
  });

  it("trackIndexはトラック数の末尾に丸める", async () => {
    await setup().playWork(listItem, 99);
    expect(play).toHaveBeenCalledWith(listItem, expect.any(Array), 1, "p2");
  });

  it("resumeWorkは準備済みの作品でplayWithResumeを呼ぶ", async () => {
    await setup().resumeWork({ id: "w1", status: "ok" } as unknown as Work);
    const prepared = await prepareWorkPlayback.mock.results[0]!.value;
    expect(playWithResume).toHaveBeenCalledWith(prepared);
    expect(play).not.toHaveBeenCalled();
  });
});
