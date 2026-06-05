// files feature のナビゲーション state フック。
// ルート絶対パス（settings 由来）を引数に取り、現在地（cwd）・選択・パンくずを束ねる。
// 階層を遡るのはパンくず（goToSegment）のみ。受動スタックはクリックしない（正典 README 準拠）。

import { useAtom } from "jotai";
import { useCallback } from "react";
import { filesRelPathAtom, filesSelectedPathAtom } from "./atoms";
import { joinPath, relSegments, rootLabel } from "./types";

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
}

export function useFilesNavigation(root: string): FilesNav {
  const [relPath, setRelPath] = useAtom(filesRelPathAtom);
  const [selectedPath, setSelectedPath] = useAtom(filesSelectedPathAtom);

  const cwd = joinPath(root, relPath);
  const addressPath = [rootLabel(root), ...relPath];

  const openDir = useCallback((absPath: string) => {
    setRelPath(relSegments(root, absPath));
    setSelectedPath(absPath);
  }, [root, setRelPath, setSelectedPath]);

  const selectFile = useCallback((absPath: string) => {
    setSelectedPath(absPath);
  }, [setSelectedPath]);

  const goToSegment = useCallback((index: number) => {
    // index 0 = ルート、以降は子 segments。relPath を index 件に切り詰める。
    setRelPath((prev) => prev.slice(0, index));
    setSelectedPath(null);
  }, [setRelPath, setSelectedPath]);

  return { root, cwd, relPath, selectedPath, addressPath, openDir, selectFile, goToSegment };
}
