import { describe, expect, it } from "vitest";
import type { Track, WorkSummary } from "../../src/entities/work/model";
import {
  PLAYER_CONTROLLER_INITIAL,
  PlayerController,
  reducePlayer,
  type PlaybackItem,
  type PlayerControllerInput,
} from "../../src/entities/player/model/playerController";

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
      { type: "startRequested", item: { ...item(), trackIndex: 1 } },
      { type: "audioFailed", error },
    ]);

    expect(result.state.status).toBe("error");
    expect(result.state.playbackError).toEqual(error);
    expect(result.commands).toEqual([{ type: "persistResume", reason: "error" }]);
  });

  it("途中トラックのデコード失敗は次トラックへ進みスキップを通知する", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const result = scenario([
      { type: "startRequested", item: item() },
      { type: "audioFailed", error },
    ]);

    expect(result.state.status).toBe("loading");
    expect(result.state.item?.trackIndex).toBe(1);
    expect(result.state.playbackError).toBeNull();
    expect(result.state.consecutiveTrackFailures).toBe(1);
    expect(result.commands).toEqual([
      { type: "persistResume", reason: "track-change" },
      {
        type: "loadTrack",
        item: { ...item(), trackIndex: 1 },
        autoplay: true,
        reusesAsset: true,
      },
      { type: "notifyTrackSkipped", trackTitle: "Track 1", trackIndex: 0 },
    ]);
  });

  it("連続してデコード失敗すると次があっても停止する", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const threeTracks = [
      ...tracks,
      { id: "track-3", title: "Track 3", file: "audio.wav", start: 60, end: 90 },
    ];
    const started = { ...item(), tracks: threeTracks };
    const result = scenario([
      { type: "startRequested", item: started },
      { type: "audioFailed", error },
      { type: "audioFailed", error },
    ]);

    expect(result.state.status).toBe("error");
    expect(result.state.item?.trackIndex).toBe(1);
    expect(result.state.playbackError).toEqual(error);
    expect(result.state.consecutiveTrackFailures).toBe(2);
    expect(result.commands).toEqual([{ type: "persistResume", reason: "error" }]);
  });

  it("スキップ後に再生が始まれば次の失敗は再びスキップする", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const threeTracks = [
      ...tracks,
      { id: "track-3", title: "Track 3", file: "audio.wav", start: 60, end: 90 },
    ];
    const started = { ...item(), tracks: threeTracks };
    const result = scenario([
      { type: "startRequested", item: started },
      { type: "audioFailed", error },
      { type: "audioPlaying" },
      { type: "audioFailed", error },
    ]);

    expect(result.state.status).toBe("playing");
    expect(result.state.item?.trackIndex).toBe(2);
    expect(result.state.playbackError).toBeNull();
    expect(result.commands.at(-1)).toEqual({
      type: "notifyTrackSkipped",
      trackTitle: "Track 2",
      trackIndex: 1,
    });
  });

  it("停止時は resume保存・pause の順でコマンドを発行し、ロード済みトラックを解放する", () => {
    const result = scenario([{ type: "startRequested", item: item() }, { type: "stopRequested" }]);

    expect(result.state.status).toBe("idle");
    expect(result.state.item).toBeNull();
    expect(result.state.loaded).toBeNull();
    expect(result.commands).toEqual([
      { type: "persistResume", reason: "stop" },
      { type: "pauseAudio" },
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

  it("error状態でのretryRequestedは同じ項目を再読み込みする", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const result = scenario([
      { type: "startRequested", item: { ...item(), trackIndex: 1 } },
      { type: "audioFailed", error },
      { type: "retryRequested" },
    ]);

    expect(result.state.status).toBe("loading");
    expect(result.state.playbackError).toBeNull();
    expect(result.state.consecutiveTrackFailures).toBe(0);
    expect(result.commands).toEqual([
      {
        type: "loadTrack",
        item: { ...item(), trackIndex: 1 },
        positionSec: result.state.positionSec,
        autoplay: true,
        reusesAsset: false,
      },
    ]);
  });

  it("error状態以外でのretryRequestedは何もしない", () => {
    const result = scenario([{ type: "startRequested", item: item() }, { type: "retryRequested" }]);

    expect(result.commands).toEqual([]);
  });

  it("error状態のerrorDismissedはpausedへ戻りエラーを消す", () => {
    const error = { source: "media" as const, code: 4, message: "unsupported" };
    const result = scenario([
      { type: "startRequested", item: { ...item(), trackIndex: 1 } },
      { type: "audioFailed", error },
      { type: "errorDismissed" },
    ]);

    expect(result.state.status).toBe("paused");
    expect(result.state.playbackError).toBeNull();
    expect(result.state.consecutiveTrackFailures).toBe(0);
    expect(result.commands).toEqual([]);
  });

  describe("トラック終端と同一音源の継続", () => {
    const otherFileTracks: Track[] = [
      { id: "track-1", title: "Track 1", file: "a.wav", start: 0, end: 30 },
      { id: "track-2", title: "Track 2", file: "b.wav", start: 0, end: 30 },
    ];

    function playing(trackList: Track[] = tracks) {
      return scenario([
        { type: "startRequested", item: { ...item(), tracks: trackList } },
        { type: "audioPlaying" },
      ]);
    }

    it("同一ファイルの次区間への移動は再ロードせず、再生中ならplayingを維持する", () => {
      const result = scenario([
        { type: "startRequested", item: item() },
        { type: "audioPlaying" },
        { type: "trackSelected", trackIndex: 1 },
      ]);

      expect(result.state.status).toBe("playing");
      expect(result.state.loaded).toMatchObject({ kind: "work", trackIndex: 1 });
      expect(result.commands.find((command) => command.type === "loadTrack")).toMatchObject({
        reusesAsset: true,
        autoplay: true,
      });
    });

    it("再生中に別ファイルへ明示選択すると再ロードしてloadingになる", () => {
      const result = scenario([
        { type: "startRequested", item: { ...item(), tracks: otherFileTracks } },
        { type: "audioPlaying" },
        { type: "trackSelected", trackIndex: 1 },
      ]);

      expect(result.state.status).toBe("loading");
      expect(result.commands.find((command) => command.type === "loadTrack")).toMatchObject({
        reusesAsset: false,
      });
    });

    it("同じトラックの再開始や別作品の同名ファイルは同一音源として扱わない", () => {
      const sameTrack = scenario([
        { type: "startRequested", item: item() },
        { type: "startRequested", item: item() },
      ]);
      const otherWork = scenario([
        { type: "startRequested", item: item() },
        {
          type: "startRequested",
          item: {
            ...item(),
            source: { kind: "work", work: { ...work, id: "work-2" } },
            trackIndex: 1,
          },
        },
      ]);

      expect(sameTrack.commands.find((c) => c.type === "loadTrack")).toMatchObject({
        reusesAsset: false,
      });
      expect(otherWork.commands.find((c) => c.type === "loadTrack")).toMatchObject({
        reusesAsset: false,
      });
    });

    it("engine解放後は同一ファイルでも再ロードする", () => {
      const result = scenario([
        { type: "startRequested", item: item() },
        { type: "engineReleased" },
        { type: "trackSelected", trackIndex: 1 },
      ]);

      expect(result.commands.find((command) => command.type === "loadTrack")).toMatchObject({
        reusesAsset: false,
      });
    });

    it("仮想終端で同一ファイルの次区間があれば止めずに次へ進む", () => {
      const result = reducePlayer(playing().state, { type: "audioTimeChanged", audioSec: 30 });

      expect(result.state.item?.trackIndex).toBe(1);
      expect(result.state.status).toBe("playing");
      expect(result.commands.map((command) => command.type)).toEqual([
        "persistResume",
        "loadTrack",
      ]);
    });

    it("仮想終端で別ファイルへ進むときはengineを止めてから次へ進む", () => {
      const result = reducePlayer(playing(otherFileTracks).state, {
        type: "audioTimeChanged",
        audioSec: 30,
      });

      expect(result.state.item?.trackIndex).toBe(1);
      expect(result.commands.map((command) => command.type)).toEqual([
        "pauseAudio",
        "persistResume",
        "loadTrack",
      ]);
    });

    it("最終トラックの仮想終端で停止し、重複した終端通知は無視する", () => {
      const last = scenario([
        { type: "startRequested", item: { ...item(), trackIndex: 1 } },
        { type: "audioPlaying" },
      ]).state;
      const ended = reducePlayer(last, { type: "audioTimeChanged", audioSec: 60 });
      const duplicated = reducePlayer(ended.state, { type: "audioEnded" });

      expect(ended.state.status).toBe("ended");
      expect(ended.state.trackEnded).toBe(true);
      expect(ended.commands.map((command) => command.type)).toEqual([
        "pauseAudio",
        "workCompleted",
      ]);
      expect(duplicated.commands).toEqual([]);
      expect(duplicated.state).toBe(ended.state);
    });

    it("終端で止まったトラックを再生し直すと先頭へ戻す", () => {
      const last = scenario([
        { type: "startRequested", item: { ...item(), trackIndex: 1 } },
        { type: "audioPlaying" },
        { type: "audioTimeChanged", audioSec: 60 },
      ]).state;
      const paused = reducePlayer(last, { type: "audioPaused" });
      const replayed = reducePlayer(last, { type: "audioPlaying" });

      expect(paused.state).toBe(last);
      expect(replayed.state).toMatchObject({
        status: "playing",
        trackEnded: false,
        positionSec: 0,
      });
      expect(replayed.commands).toEqual([{ type: "seekAudio", positionSec: 0 }]);
    });

    it("終端に達していない時刻更新でtrackEndedを解除する", () => {
      const last = scenario([
        { type: "startRequested", item: { ...item(), trackIndex: 1 } },
        { type: "audioTimeChanged", audioSec: 60 },
        { type: "audioTimeChanged", audioSec: 40 },
      ]).state;

      expect(last.trackEnded).toBe(false);
      expect(last.positionSec).toBe(10);
    });

    it("loop時の仮想終端はtrackEndedを立てず、区間先頭へ戻して再生を続ける", () => {
      const result = scenario([
        { type: "startRequested", item: { ...item(), trackIndex: 1 } },
        { type: "loopChanged", loop: true },
        { type: "audioTimeChanged", audioSec: 60 },
      ]);

      expect(result.state.trackEnded).toBe(false);
      expect(result.commands).toEqual([
        { type: "pauseAudio" },
        { type: "seekAudio", positionSec: 0 },
        { type: "playAudio" },
      ]);
    });

    it("A-Bリピートの戻り先シークを区間終端の終了判定より優先する", () => {
      const result = scenario([
        { type: "startRequested", item: item() },
        { type: "abPointSet", point: "a", positionSec: 10 },
        { type: "abPointSet", point: "b", positionSec: 30 },
        { type: "audioTimeChanged", audioSec: 30 },
      ]);

      expect(result.state.item?.trackIndex).toBe(0);
      expect(result.state.trackEnded).toBe(false);
      expect(result.commands).toEqual([{ type: "seekAudio", positionSec: 10 }]);
    });

    it("Filesモードの即席トラックはファイル全体長から再生時間を解決する", () => {
      const fileItem: PlaybackItem = {
        source: { kind: "file" },
        playlistId: null,
        tracks: [{ id: "f", title: "f", file: "f.wav" }],
        trackIndex: 0,
        completionScope: "queue",
      };
      const result = scenario([
        { type: "startRequested", item: fileItem },
        { type: "audioDurationChanged", durationSec: 90 },
        { type: "audioTimeChanged", audioSec: 12 },
      ]);

      expect(result.state).toMatchObject({ durationSec: 90, fileDurationSec: 90, positionSec: 12 });
      expect(result.state.loaded).toMatchObject({ kind: "file", trackIndex: 0 });
    });

    it("登録トラックではファイル全体長でdurationSecを上書きしない", () => {
      const resolved = {
        id: "r",
        title: "r",
        file: "r.wav",
        start: 0,
        end: 30,
        durationSec: 30,
        durationKind: "resolved" as const,
      };
      const result = scenario([
        { type: "startRequested", item: { ...item(), tracks: [resolved] } },
        { type: "audioDurationChanged", durationSec: 90 },
      ]);

      expect(result.state.durationSec).toBe(30);
      expect(result.state.fileDurationSec).toBeNull();
    });

    it("同一音源への移動ではファイル全体長を引き継ぎ、再ロードでは破棄する", () => {
      const fileTracks = [
        { id: "f1", title: "f1", file: "f.wav" },
        { id: "f2", title: "f2", file: "f.wav" },
        { id: "g", title: "g", file: "g.wav" },
      ];
      const fileItem: PlaybackItem = {
        source: { kind: "file" },
        playlistId: null,
        tracks: fileTracks,
        trackIndex: 0,
        completionScope: "queue",
      };
      const kept = scenario([
        { type: "startRequested", item: fileItem },
        { type: "audioDurationChanged", durationSec: 90 },
        { type: "trackSelected", trackIndex: 1 },
      ]);
      const dropped = reducePlayer(kept.state, { type: "trackSelected", trackIndex: 2 });

      expect(kept.state.fileDurationSec).toBe(90);
      expect(dropped.state.fileDurationSec).toBeNull();
    });
  });
});
