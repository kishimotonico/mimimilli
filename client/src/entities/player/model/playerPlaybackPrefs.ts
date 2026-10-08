import { z } from "zod";
import {
  PLAYER_CONTROLLER_INITIAL,
  type PlayerController,
  type PlayerControllerState,
} from "./playerController";

export const PLAYER_PLAYBACK_PREFS_KEY = "mimimilli:playerPlaybackPrefs";

export const PLAYER_PLAYBACK_PREFS_INITIAL = {
  volume: PLAYER_CONTROLLER_INITIAL.volume,
  loop: PLAYER_CONTROLLER_INITIAL.loop,
  playbackRate: PLAYER_CONTROLLER_INITIAL.playbackRate,
  channelSwap: PLAYER_CONTROLLER_INITIAL.channelSwap,
};

export type PlayerPlaybackPrefs = typeof PLAYER_PLAYBACK_PREFS_INITIAL;

const playerPlaybackPrefsSchema = z.object({
  volume: z.number().finite().min(0).max(100).catch(PLAYER_PLAYBACK_PREFS_INITIAL.volume),
  loop: z.boolean().catch(PLAYER_PLAYBACK_PREFS_INITIAL.loop),
  playbackRate: z.number().finite().positive().catch(PLAYER_PLAYBACK_PREFS_INITIAL.playbackRate),
  channelSwap: z.boolean().catch(PLAYER_PLAYBACK_PREFS_INITIAL.channelSwap),
});

export type PlayerPlaybackStorage = Pick<Storage, "getItem" | "setItem">;

export function parsePlayerPlaybackPrefs(value: unknown): PlayerPlaybackPrefs {
  const parsed = playerPlaybackPrefsSchema.safeParse(value);
  return parsed.success ? parsed.data : PLAYER_PLAYBACK_PREFS_INITIAL;
}

export function loadPlayerPlaybackPrefs(
  storage: PlayerPlaybackStorage = localStorage,
): PlayerPlaybackPrefs {
  try {
    const raw = storage.getItem(PLAYER_PLAYBACK_PREFS_KEY);
    if (raw === null) return PLAYER_PLAYBACK_PREFS_INITIAL;
    return parsePlayerPlaybackPrefs(JSON.parse(raw));
  } catch {
    return PLAYER_PLAYBACK_PREFS_INITIAL;
  }
}

export function savePlayerPlaybackPrefs(
  prefs: PlayerPlaybackPrefs,
  storage: PlayerPlaybackStorage = localStorage,
): void {
  storage.setItem(PLAYER_PLAYBACK_PREFS_KEY, JSON.stringify(prefs));
}

export function playbackPrefsFromState(state: PlayerControllerState): PlayerPlaybackPrefs {
  return {
    volume: state.volume,
    loop: state.loop,
    playbackRate: state.playbackRate,
    channelSwap: state.channelSwap,
  };
}

export function arePlaybackPrefsEqual(a: PlayerPlaybackPrefs, b: PlayerPlaybackPrefs): boolean {
  return (
    a.volume === b.volume &&
    a.loop === b.loop &&
    a.playbackRate === b.playbackRate &&
    a.channelSwap === b.channelSwap
  );
}

export function withPlaybackPrefs(
  state: PlayerControllerState,
  prefs: PlayerPlaybackPrefs,
): PlayerControllerState {
  return { ...state, ...prefs };
}

export function persistPlaybackPrefsOnChange(
  controller: PlayerController,
  storage: PlayerPlaybackStorage = localStorage,
): () => void {
  let last = playbackPrefsFromState(controller.getState());
  return controller.subscribeState((state) => {
    const next = playbackPrefsFromState(state);
    if (arePlaybackPrefsEqual(last, next)) return;
    last = next;
    savePlayerPlaybackPrefs(next, storage);
  });
}
