import { useAtomValue } from "jotai";
import { appModeAtom } from "../features/navigation/model/navigationAtoms";
import LibraryView from "../features/library/ui/LibraryView";
import FilesView from "../features/files/ui/FilesView";
import type { FsEntry } from "../features/files/model/types";
import type { Work, WorkListItem } from "@mimimilli/shared";

interface AppBodyProps {
  rootFolder: string;
  onPlayFile: (entry: FsEntry) => void;
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
}

export default function AppBody({ rootFolder, onPlayFile, onPlay, onResume }: AppBodyProps) {
  const mode = useAtomValue(appModeAtom);

  if (mode === "files") {
    return <FilesView rootFolder={rootFolder} onPlayFile={onPlayFile} />;
  }

  return <LibraryView onPlay={onPlay} onResume={onResume} />;
}
