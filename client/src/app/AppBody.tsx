import { lazy, Suspense } from "react";
import { useAtomValue } from "jotai";
import { appModeAtom } from "../entities/navigation/model/appRouteStore";
import LibraryView from "../features/library/ui/LibraryView";
import WorkDetailPage from "../features/library/ui/WorkDetailPage";
import NowPlayingView from "../features/player/ui/NowPlayingView";
import { playerDockBarVisibleAtom } from "../features/player/model/playerPresentationAtoms";

const FilesView = lazy(() => import("../features/files/ui/FilesView"));

interface AppBodyProps {
  /** 再生中タブから全画面作品詳細（/work/:id）を開く */
  onOpenWorkDetail: (workId: string) => void;
}

export default function AppBody({ onOpenWorkDetail }: AppBodyProps) {
  const mode = useAtomValue(appModeAtom);
  const dockedBarActive = useAtomValue(playerDockBarVisibleAtom);

  if (mode === "files") {
    return (
      <Suspense fallback={null}>
        <FilesView />
      </Suspense>
    );
  }

  if (mode === "nowPlaying") {
    return <NowPlayingView onOpenWork={onOpenWorkDetail} />;
  }

  if (mode === "workDetail") {
    return <WorkDetailPage />;
  }

  return <LibraryView dockedBarActive={dockedBarActive} />;
}
