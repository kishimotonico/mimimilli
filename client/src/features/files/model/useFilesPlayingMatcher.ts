// 再生中トラックが指定エントリと一致するかを判定するマッチャーを返す。
// FileColumn（一覧の各行）・FilePreview（プレビュー対象1件）の両方が同じ判定式を使う。

import { useAtomValue } from "jotai";
import { useCallback } from "react";
import {
  playingFsPathAtom,
  playingTrackRelPathAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import type { FsEntry } from "./types";

export function useFilesPlayingMatcher(): (entry: FsEntry) => boolean {
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingRelPath = useAtomValue(playingTrackRelPathAtom);
  const playingFsPath = useAtomValue(playingFsPathAtom);

  return useCallback(
    (entry: FsEntry) => {
      if (playingFsPath) return entry.path === playingFsPath;
      return (
        !!playingWorkId &&
        entry.workId === playingWorkId &&
        entry.workRelPath != null &&
        entry.workRelPath === playingRelPath
      );
    },
    [playingFsPath, playingWorkId, playingRelPath],
  );
}
