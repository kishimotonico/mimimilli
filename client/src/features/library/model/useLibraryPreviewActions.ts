import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import type { AppMode } from "../../../shared/model/appMode";

interface UseLibraryPreviewActionsOptions {
  selectedWork: Work | null;
  rootFolder: string;
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  openWorkDetail: (workId: string) => void;
  setAppMode: (mode: AppMode) => void;
}

/** 選択中作品プレビューの再生系ハンドラーと、その作品が再生中かどうかの判定をまとめる。 */
export function useLibraryPreviewActions({
  selectedWork,
  rootFolder,
  onPlay,
  onResume,
  openWorkDetail,
  setAppMode,
}: UseLibraryPreviewActionsOptions) {
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const isSelectedWorkPlaying = Boolean(selectedWork) && playingWorkId === selectedWork?.id;

  const handlePlay = useCallback(
    (trackIndex: number) => {
      if (selectedWork) {
        onPlay(
          toWorkListItem(
            {
              ...selectedWork,
              trackCount: getDefaultPlaylistTrackCount(selectedWork),
            },
            rootFolder,
          ),
          trackIndex,
        );
      }
    },
    [selectedWork, rootFolder, onPlay],
  );

  const handleResume = useCallback(() => {
    if (selectedWork) onResume(selectedWork);
  }, [selectedWork, onResume]);

  const handleExpand = useCallback(() => {
    if (selectedWork) openWorkDetail(selectedWork.id);
  }, [selectedWork, openWorkDetail]);

  const handleGoToPlayingScreen = useCallback(() => setAppMode("nowPlaying"), [setAppMode]);

  return {
    isPlaybackActive,
    isSelectedWorkPlaying,
    playingTrackIndexForSelected: isSelectedWorkPlaying ? (playingTrackIndex ?? null) : null,
    handlePlay,
    handleResume,
    handleExpand,
    handleGoToPlayingScreen,
  };
}
