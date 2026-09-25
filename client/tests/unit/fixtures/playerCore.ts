import type { Store } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import {
  PLAYER_CORE_INITIAL,
  playerCoreAtom,
  type PlayerCoreState,
} from "../../../src/entities/player/model/atoms";

/** playingWorkId/isPlaybackActiveはplayerCoreAtomからの派生atomのため、
 *  テストで再生中状態を作るにはこのatomごと書き換える。 */
export function setPlayingWork(
  store: Store,
  workId: string,
  overrides: Partial<PlayerCoreState> = {},
) {
  const work: WorkListItem = {
    id: workId,
    title: workId,
    cover: null,
    status: "ok",
    totalDurationSec: 0,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
  };
  store.set(playerCoreAtom, {
    ...PLAYER_CORE_INITIAL,
    currentWork: work,
    currentTrackIndex: 0,
    isPlaying: true,
    ...overrides,
  });
}
