import { lazy, Suspense } from "react";
import { useAtomValue } from "jotai";
import { appModeAtom } from "../entities/navigation/model/appRouteStore";
import LibraryView from "../features/library/ui/LibraryView";
import WorkDetailPage from "../features/library/ui/WorkDetailPage";
import { playerDockBarVisibleAtom } from "../features/player/model/playerPresentationAtoms";

const FilesView = lazy(() => import("../features/files/ui/FilesView"));

export default function AppBody() {
  const mode = useAtomValue(appModeAtom);
  const dockedBarActive = useAtomValue(playerDockBarVisibleAtom);

  if (mode === "files") {
    return (
      <Suspense fallback={null}>
        <FilesView />
      </Suspense>
    );
  }

  if (mode === "workDetail") {
    return <WorkDetailPage />;
  }

  return <LibraryView dockedBarActive={dockedBarActive} />;
}
