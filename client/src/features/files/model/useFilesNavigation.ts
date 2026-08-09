// files feature のナビゲーション state フック。
// ルート絶対パス（settings 由来）を引数に取り、現在地（cwd）・選択・パンくずを束ねる。
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
import { joinPath } from "../../../shared/lib/fsPath";
import { rootLabel } from "./types";

export interface FilesNav {
  /** ルート絶対パス */
  root: string;
  /** カレント dir 絶対パス */
  cwd: string;
  /** ルート相対 segments（[] = ルート） */
  relPath: string[];
  /** 選択中エントリの絶対パス */
  selectedPath: string | null;
  /** パンくず表示用（[ルート名, ...子segments]） */
  addressPath: string[];

  /** dir を開いてカレントにする（絶対パス） */
  openDir: (absPath: string) => void;
  /** ファイルを選択する（絶対パス） */
  selectFile: (absPath: string) => void;
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

  const cwd = joinPath(root, relPath);
  const addressPath = [rootLabel(root), ...relPath];

  const openDir = useCallback(
    (absPath: string) => openDirAction({ root, absPath }),
    [openDirAction, root],
  );

  const selectFile = useCallback(
    (absPath: string) => selectFileAction({ root, absPath }),
    [root, selectFileAction],
  );

  return { root, cwd, relPath, selectedPath, addressPath, openDir, selectFile, goToSegment, goUp };
}
