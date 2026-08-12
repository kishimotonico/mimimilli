// files feature のナビゲーション state フック。
// WorkspacePath を基準に、現在地・選択・パンくずを束ねる。
// 階層を遡るのはパンくず（goToSegment）のみ。受動スタックはクリックしない（正典 README 準拠）。

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  filesRelPathAtom,
  filesSelectedPathAtom,
} from "../../../entities/file-system/model/navigationAtoms";
import {
  goToFilesSegmentAtom,
  goUpFilesAtom,
  openFilesDirAtom,
  selectFilesEntryAtom,
} from "./filesNavigationActions";
import { rootLabel } from "./types";
import { workspacePath, type WorkspacePath } from "@mimimilli/shared";

export interface FilesNav {
  /** Workspace root の表示名 */
  root: string;
  /** カレント dir の WorkspacePath */
  cwd: WorkspacePath;
  /** ルート相対 segments（[] = ルート） */
  relPath: string[];
  /** 選択中エントリの WorkspacePath */
  selectedPath: WorkspacePath | null;
  /** パンくず表示用（[ルート名, ...子segments]） */
  addressPath: string[];

  /** dir を開いてカレントにする */
  openDir: (absPath: WorkspacePath) => void;
  /** ファイルを選択する */
  selectFile: (absPath: WorkspacePath) => void;
  /** パンくず index へ移動（0 = ルート） */
  goToSegment: (index: number) => void;
  /** 1つ上の階層へ（受動スタックのクリック用） */
  goUp: () => void;
}

export function useFilesNavigation(root: string): FilesNav {
  const relPath = useAtomValue(filesRelPathAtom);
  const selectedPath = useAtomValue(filesSelectedPathAtom);
  const openDirAction = useSetAtom(openFilesDirAtom);
  const selectFileAction = useSetAtom(selectFilesEntryAtom);
  const goToSegment = useSetAtom(goToFilesSegmentAtom);
  const goUp = useSetAtom(goUpFilesAtom);

  const cwd = workspacePath(relPath.join("/"));
  const addressPath = [rootLabel(root), ...relPath];

  const openDir = useCallback((path: WorkspacePath) => openDirAction(path), [openDirAction]);

  const selectFile = useCallback(
    (path: WorkspacePath) => selectFileAction(path),
    [selectFileAction],
  );

  return { root, cwd, relPath, selectedPath, addressPath, openDir, selectFile, goToSegment, goUp };
}
