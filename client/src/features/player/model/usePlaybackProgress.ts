// 高頻度更新の再生位置を購読する headless hook。
// BarSeekStrip / PopupSeek / FullScreenScrub の3 leaf だけが呼び出すこと。

import { useAtomValue } from "jotai";
import { playerCurrentTimeAtom, playerDurationAtom } from "../../../entities/player/model/atoms";

export interface PlaybackProgress {
  currentTime: number;
  duration: number | null;
  /** 再生位置の割合（0-100）。duration が未確定/0 のときは 0 */
  pct: number;
}

export function usePlaybackProgress(): PlaybackProgress {
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  const pct = duration !== null && duration > 0 ? (currentTime / duration) * 100 : 0;
  return { currentTime, duration, pct };
}
