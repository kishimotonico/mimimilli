import { describe, expect, it, vi } from "vitest";
import type { Track, Work } from "../../src/entities/work/model";
import { ApiRequestError } from "../../src/shared/api/http";
import { PlayerController } from "../../src/entities/player/model/playerController";
import {
  requestWorkPlayback,
  type WorkPlaybackRequestDeps,
} from "../../src/entities/player/model/workPlaybackRequest";

const tracks: Track[] = [{ id: "track-1", title: "Track 1", file: "audio.wav", start: 0, end: 30 }];

function preparedWork(id: string): Work {
  return { id, status: "ok", playlists: [{ id: "playlist-1", tracks }] } as unknown as Work;
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const controller = new PlayerController();
  const prepares = new Map<string, ReturnType<typeof deferred<Work>>>();
  const cacheUpdates: ReturnType<typeof deferred>[] = [];
  const onError = vi.fn();
  const deps: WorkPlaybackRequestDeps = {
    guard: controller.playRequests,
    prepare: (id) => {
      const d = deferred<Work>();
      prepares.set(id, d);
      return d.promise;
    },
    updateCaches: () => {
      const d = deferred();
      cacheUpdates.push(d);
      return d.promise;
    },
    onError,
  };
  const started: string[] = [];
  // 実際の再生開始と同じく、controllerにstartRequestedを流す
  const request = (id: string, status: Work["status"] = "ok") =>
    requestWorkPlayback(deps, { id, status }, (prepared) => {
      started.push(prepared.id);
      controller.dispatch({
        type: "startRequested",
        item: {
          source: { kind: "work", work: prepared },
          playlistId: "playlist-1",
          tracks,
          trackIndex: 0,
          completionScope: "work",
        },
      });
    });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { controller, prepares, cacheUpdates, onError, started, request, flush };
}

describe("requestWorkPlayback", () => {
  it("準備とキャッシュ更新を待ってから再生を始める", async () => {
    const t = setup();
    const done = t.request("a");
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await t.flush();
    expect(t.started).toEqual([]);
    t.cacheUpdates[0]!.resolve();
    await done;
    expect(t.started).toEqual(["a"]);
    expect(t.controller.getState().status).toBe("loading");
  });

  it("再生できない状態の作品は準備に入らない", async () => {
    const t = setup();
    await t.request("a", "missing");
    expect(t.prepares.size).toBe(0);
  });

  it("別の画面から続けて要求すると、古い要求は準備が後から終わっても再生を始めない", async () => {
    const t = setup();
    const first = t.request("a");
    const second = t.request("b");
    t.prepares.get("b")!.resolve(preparedWork("b"));
    await t.flush();
    t.cacheUpdates[0]!.resolve();
    await second;
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await first;
    expect(t.started).toEqual(["b"]);
    expect(t.cacheUpdates).toHaveLength(1);
  });

  it("キャッシュ更新を待っている間に後続の要求が来た場合も、古い要求は再生を始めない", async () => {
    const t = setup();
    const first = t.request("a");
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await t.flush();
    const second = t.request("b");
    t.prepares.get("b")!.resolve(preparedWork("b"));
    await t.flush();
    t.cacheUpdates[0]!.resolve();
    t.cacheUpdates[1]!.resolve();
    await Promise.all([first, second]);
    expect(t.started).toEqual(["b"]);
  });

  it("準備を待っている間に停止すると、その要求は再生を始めない", async () => {
    const t = setup();
    const pending = t.request("a");
    t.controller.dispatch({ type: "stopRequested" });
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await pending;
    expect(t.started).toEqual([]);
    expect(t.cacheUpdates).toHaveLength(0);
    expect(t.controller.getState().status).toBe("idle");
  });

  it("キャッシュ更新を待っている間に停止すると、その要求は再生を始めない", async () => {
    const t = setup();
    const pending = t.request("a");
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await t.flush();
    t.controller.dispatch({ type: "stopRequested" });
    t.cacheUpdates[0]!.resolve();
    await pending;
    expect(t.started).toEqual([]);
    expect(t.controller.getState().status).toBe("idle");
  });

  it("待っている間に別の再生が始まった場合も、古い要求は上書きしない", async () => {
    const t = setup();
    const pending = t.request("a");
    t.controller.dispatch({
      type: "startRequested",
      item: {
        source: { kind: "file" },
        playlistId: null,
        tracks,
        trackIndex: 0,
        completionScope: "queue",
      },
    });
    t.prepares.get("a")!.resolve(preparedWork("a"));
    await pending;
    expect(t.started).toEqual([]);
    expect(t.controller.getState().item?.source.kind).toBe("file");
  });

  it("準備の失敗はonErrorへ渡す", async () => {
    const t = setup();
    const failing = t.request("a");
    const error = new Error("boom");
    t.prepares.get("a")!.reject(error);
    await failing;
    expect(t.onError).toHaveBeenCalledWith(error);
  });

  it("root再設定中のエラーはonErrorへ渡さない", async () => {
    const t = setup();
    const failing = t.request("a");
    t.prepares.get("a")!.reject(new ApiRequestError(409, "root_reconfiguring", "reconfiguring"));
    await failing;
    expect(t.onError).not.toHaveBeenCalled();
  });
});
