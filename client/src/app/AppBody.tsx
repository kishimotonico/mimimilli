import { lazy, Suspense } from "react";
import { useAtomValue } from "jotai";
import { appModeAtom } from "../shared/model/appModeAtoms";
import LibraryView from "../features/library/ui/LibraryView";
import WorkDetailPage from "../features/library/ui/WorkDetailPage";
import NowPlayingView from "../features/player/ui/NowPlayingView";
import type { Work, WorkListItem } from "@mimimilli/shared";
import type { PlaybackTrack } from "../entities/player/model/playbackTrack";

const FilesView = lazy(() => import("../features/files/ui/FilesView"));

interface AppBodyProps {
  rootFolder: string;
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  onTogglePlay: () => void;
  onPlayFile: (tracks: PlaybackTrack[], trackIndex: number) => void;
  /** 再生中タブから全画面作品詳細（/work/:id）を開く */
  onOpenWorkDetail: (workId: string) => void;
}

export default function AppBody({
  rootFolder,
  onPlay,
  onResume,
  onTogglePlay,
  onPlayFile,
  onOpenWorkDetail,
}: AppBodyProps) {
  const mode = useAtomValue(appModeAtom);

  if (mode === "files") {
    return (
      <Suspense fallback={null}>
        <FilesView rootFolder={rootFolder} onPlayFile={onPlayFile} />
      </Suspense>
    );
  }

  if (mode === "nowPlaying") {
    return <NowPlayingView onOpenWork={onOpenWorkDetail} />;
  }

  if (mode === "workDetail") {
    return <WorkDetailPage onPlay={onPlay} onResume={onResume} onTogglePlay={onTogglePlay} />;
  }

  return <LibraryView onPlay={onPlay} onResume={onResume} onTogglePlay={onTogglePlay} />;
}
