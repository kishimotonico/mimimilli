import { describe, expect, it } from "vitest";
import {
  PLAYER_CONTROLLER_INITIAL,
  PlayerController,
} from "../../src/entities/player/model/playerController";
import {
  PLAYER_PLAYBACK_PREFS_INITIAL,
  PLAYER_PLAYBACK_PREFS_KEY,
  loadPlayerPlaybackPrefs,
  parsePlayerPlaybackPrefs,
  persistPlaybackPrefsOnChange,
  savePlayerPlaybackPrefs,
  withPlaybackPrefs,
  type PlayerPlaybackStorage,
} from "../../src/entities/player/model/playerPlaybackPrefs";

function memoryStorage(initial: Record<string, string> = {}): PlayerPlaybackStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("parsePlayerPlaybackPrefs", () => {
  it("欠損・非オブジェクトは既定値にする", () => {
    expect(parsePlayerPlaybackPrefs(undefined)).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
    expect(parsePlayerPlaybackPrefs(null)).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
    expect(parsePlayerPlaybackPrefs("loud")).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
    expect(parsePlayerPlaybackPrefs([])).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
  });

  it("不正なフィールドだけ既定値に戻し、正当な値は残す", () => {
    expect(
      parsePlayerPlaybackPrefs({
        volume: 200,
        loop: true,
        playbackRate: 1.25,
        channelSwap: "yes",
      }),
    ).toEqual({
      volume: PLAYER_PLAYBACK_PREFS_INITIAL.volume,
      loop: true,
      playbackRate: 1.25,
      channelSwap: PLAYER_PLAYBACK_PREFS_INITIAL.channelSwap,
    });
  });
});

describe("load/savePlayerPlaybackPrefs", () => {
  it("未保存なら既定値を返す", () => {
    expect(loadPlayerPlaybackPrefs(memoryStorage())).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
  });

  it("不正JSONなら既定値を返す", () => {
    const storage = memoryStorage({ [PLAYER_PLAYBACK_PREFS_KEY]: "{not-json" });
    expect(loadPlayerPlaybackPrefs(storage)).toEqual(PLAYER_PLAYBACK_PREFS_INITIAL);
  });

  it("保存した音量・再生速度・ループ・L/R入替を復元する", () => {
    const storage = memoryStorage();
    const prefs = { volume: 40, loop: true, playbackRate: 1.5, channelSwap: true };
    savePlayerPlaybackPrefs(prefs, storage);
    expect(loadPlayerPlaybackPrefs(storage)).toEqual(prefs);
  });
});

describe("persistPlaybackPrefsOnChange", () => {
  it("再生パラメータの変更だけを保存する", () => {
    const storage = memoryStorage();
    const controller = new PlayerController(
      withPlaybackPrefs(PLAYER_CONTROLLER_INITIAL, {
        volume: 40,
        loop: true,
        playbackRate: 1.25,
        channelSwap: true,
      }),
    );
    persistPlaybackPrefsOnChange(controller, storage);

    controller.dispatch({ type: "audioTimeUpdated", positionSec: 12 });
    expect(storage.getItem(PLAYER_PLAYBACK_PREFS_KEY)).toBeNull();

    controller.dispatch({ type: "volumeChanged", volume: 20 });
    expect(loadPlayerPlaybackPrefs(storage)).toEqual({
      volume: 20,
      loop: true,
      playbackRate: 1.25,
      channelSwap: true,
    });
  });
});
