import { lazy, Suspense } from "react";
import { useAtomValue } from "jotai";
import { appModeAtom } from "../features/navigation/model/navigationAtoms";
import LibraryView from "../features/library/ui/LibraryView";
import type { Work, WorkListItem } from "@mimimilli/shared";

const FilesView = lazy(() => import("../features/files/ui/FilesView"));

interface AppBodyProps {
  rootFolder: string;
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  onTogglePlay: () => void;
}

export default function AppBody({ rootFolder, onPlay, onResume, onTogglePlay }: AppBodyProps) {
  const mode = useAtomValue(appModeAtom);

  if (mode === "files") {
    return (
      <Suspense fallback={null}>
        <FilesView rootFolder={rootFolder} />
      </Suspense>
    );
  }

  return <LibraryView onPlay={onPlay} onResume={onResume} onTogglePlay={onTogglePlay} />;
}
