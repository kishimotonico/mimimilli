import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { Work } from "@mimimilli/shared";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";

interface UseLibraryPreviewActionsOptions {
  selectedWork: Work | null;
  openWorkDetail: (workId: string) => void;
  openNowPlaying: () => void;
}

/** 選択中作品プレビューの操作ハンドラーと、その作品が再生中かどうかの判定をまとめる。 */
export function useLibraryPreviewActions({
  selectedWork,
  openWorkDetail,
  openNowPlaying,
}: UseLibraryPreviewActionsOptions) {
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const isSelectedWorkPlaying = Boolean(selectedWork) && playingWorkId === selectedWork?.id;

  const handleExpand = useCallback(() => {
    if (selectedWork) openWorkDetail(selectedWork.id);
  }, [selectedWork, openWorkDetail]);

  const handleGoToPlayingScreen = openNowPlaying;

  return {
    isPlaybackActive,
    isSelectedWorkPlaying,
    playingTrackIndexForSelected: isSelectedWorkPlaying ? (playingTrackIndex ?? null) : null,
    handleExpand,
    handleGoToPlayingScreen,
  };
}
