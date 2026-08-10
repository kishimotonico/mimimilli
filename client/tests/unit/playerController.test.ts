import { describe, expect, it } from "vitest";
import type { Track, WorkSummary } from "../../src/entities/work/model";
import {
  PLAYER_CONTROLLER_INITIAL,
  PlayerController,
  reducePlayer,
  type PlaybackItem,
  type PlayerControllerInput,
} from "../../src/features/player/model/playerController";

const work: WorkSummary = {
  id: "work-1",
  title: "Work 1",
  cover: null,
  status: "ok",
  physicalPath: "/audio/work-1",
  totalDurationSec: 120,
  addedAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
  urls: [],
  tags: [],
  trackCount: 2,
  bookmarked: false,
  lastPlayedAt: null,
};

const tracks: Track[] = [
  { id: "track-1", title: "Track 1", file: "audio.wav", start: 0, end: 30 },
  { id: "track-2", title: "Track 2", file: "audio.wav", start: 30, end: 60 },
];

function item(completionScope: PlaybackItem["completionScope"] = "work"): PlaybackItem {
  return {
    source: { kind: "work", work },
    playlistId: completionScope === "work" ? "playlist-1" : null,
    tracks,
    trackIndex: 0,
    completionScope,
  };
}

function scenario(inputs: PlayerControllerInput[]) {
  return inputs.reduce((transition, input) => reducePlayer(transition.state, input), {
    state: PLAYER_CONTROLLER_INITIAL,
    commands: [],
  });
}

describe("PlayerController scenarios", () => {
  it("idle → loading → playing → paused を明示的に遷移する", () => {
    const controller = new PlayerController();

    controller.dispatch({ type: "startRequested", item: item() });
    expect(controller.getState().status).toBe("loading");

    controller.dispatch({ type: "audioPlaying" });
    expect(controller.getState().status).toBe("playing");

    controller.dispatch({ type: "audioPaused" });
    expect(controller.getState().status).toBe("paused");
  });

  it("区間相対時間でA-Bリピートを行う", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioDurationChanged", durationSec: 30 },
      { type: "abPointSet", point: "a", positionSec: 10 },
      { type: "abPointSet", point: "b", positionSec: 20 },
      { type: "audioTimeUpdated", positionSec: 20 },
    ]);

    expect(result.state.positionSec).toBe(10);
    expect(result.commands).toEqual([{ type: "seekAudio", positionSec: 10 }]);
  });

  it("末尾で作品聴了を通知する", () => {
    const controller = new PlayerController();
    const commands: string[] = [];
    controller.subscribeCommands((command) => commands.push(command.type));
    controller.dispatch({ type: "startRequested", item: { ...item(), trackIndex: 1 } });
    controller.dispatch({ type: "audioEnded" });

    expect(controller.getState().status).toBe("ended");
    expect(commands).toContain("workCompleted");
  });

  it("Filesの単発再生では作品聴了を通知しない", () => {
    const fileItem: PlaybackItem = {
      source: { kind: "file" },
      playlistId: null,
      tracks: [tracks[0]!],
      trackIndex: 0,
      completionScope: "queue",
    };
    const controller = new PlayerController();
    const commands: string[] = [];
    controller.subscribeCommands((command) => commands.push(command.type));
    controller.dispatch({ type: "startRequested", item: fileItem });
    controller.dispatch({ type: "audioEnded" });

    expect(commands).not.toContain("workCompleted");
  });

  it("loop時はplayingを維持して同じトラックを再生する", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "loopChanged", loop: true },
      { type: "audioEnded" },
    ]);

    expect(result.state.status).toBe("playing");
    expect(result.state.item?.trackIndex).toBe(0);
    expect(result.commands).toEqual([{ type: "seekAudio", positionSec: 0 }, { type: "playAudio" }]);
  });

  it("loading中のtoggleはpauseを指示する", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "toggleRequested" },
    ]);

    expect(result.state.status).toBe("loading");
    expect(result.commands).toEqual([{ type: "pauseAudio" }]);
  });

  it("トラック移動でA-B区間を消去し、同じ再生項目の次トラックをロードする", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "abPointSet", point: "a", positionSec: 10 },
      { type: "nextRequested" },
    ]);

    expect(result.state.item?.trackIndex).toBe(1);
    expect(result.state.abRepeat).toEqual({ a: null, b: null });
    expect(result.commands.map((command) => command.type)).toEqual(["persistResume", "loadTrack"]);
  });

  it("一時停止中に次のトラックへ切り替えても一時停止のままで、再生を再開しない", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioPlaying" },
      { type: "audioPaused" },
      { type: "nextRequested" },
    ]);

    expect(result.state.status).toBe("paused");
    expect(result.state.item?.trackIndex).toBe(1);
    const loadTrack = result.commands.find((command) => command.type === "loadTrack");
    expect(loadTrack).toMatchObject({ autoplay: false });
  });

  it("再生中に次のトラックへ切り替えた場合は再生を継続する", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioPlaying" },
      { type: "nextRequested" },
    ]);

    expect(result.state.status).toBe("playing");
    const loadTrack = result.commands.find((command) => command.type === "loadTrack");
    expect(loadTrack).toMatchObject({ autoplay: true });
  });

  it("一時停止中でもトラックリストからの明示選択では再生を開始する", () => {
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioPlaying" },
      { type: "audioPaused" },
      { type: "trackSelected", trackIndex: 1 },
    ]);

    expect(result.state.status).toBe("loading");
    const loadTrack = result.commands.find((command) => command.type === "loadTrack");
    expect(loadTrack).toMatchObject({ autoplay: true });
  });

  it("Audioエラーをerror状態にして直近位置の保存を指示する", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioFailed", error },
    ]);

    expect(result.state.status).toBe("error");
    expect(result.state.playbackError).toEqual(error);
    expect(result.commands).toEqual([{ type: "persistResume", reason: "error" }]);
  });

  it("停止時は resume保存・pause・先頭シーク・ロード済みトラック解放の順でコマンドを発行する", () => {
    const result = scenario([{ type: "startRequested", item: item() }, { type: "stopRequested" }]);

    expect(result.state.status).toBe("idle");
    expect(result.state.item).toBeNull();
    expect(result.commands).toEqual([
      { type: "persistResume", reason: "stop" },
      { type: "pauseAudio" },
      { type: "seekAudio", positionSec: 0 },
      { type: "releaseLoadedTrack" },
    ]);
  });

  it("再生対象がない状態での停止はコマンドを発行しない", () => {
    const result = scenario([{ type: "stopRequested" }]);

    expect(result.state.status).toBe("idle");
    expect(result.commands).toEqual([]);
  });

  it("idle状態への遅延audioFailedは無視する", () => {
    const error = { source: "play" as const, name: "AbortError", message: "Aborted" };
    const result = scenario([{ type: "audioFailed", error }]);

    expect(result.state.status).toBe("idle");
    expect(result.state.playbackError).toBeNull();
    expect(result.commands).toEqual([]);
  });
});
