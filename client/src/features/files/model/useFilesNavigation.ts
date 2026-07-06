// files feature のナビゲーション state フック。
// ルート絶対パス（settings 由来）を引数に取り、現在地（cwd）・選択・パンくずを束ねる。
// 階層を遡るのはパンくず（goToSegment）のみ。受動スタックはクリックしない（正典 README 準拠）。

import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { requestNavigationHistoryCommitAtom } from "../../navigation/model/navigationHistoryAtoms";
import { filesRelPathAtom, filesSelectedPathAtom, filesDirectionAtom } from "./atoms";
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
  /** 1つ上の階層へ（受動スタックのクリック用） */
  goUp: () => void;
}

export function useFilesNavigation(root: string): FilesNav {
  const [relPath, setRelPath] = useAtom(filesRelPathAtom);
  const [selectedPath, setSelectedPath] = useAtom(filesSelectedPathAtom);
  const setDirection = useSetAtom(filesDirectionAtom);
  const requestCommit = useSetAtom(requestNavigationHistoryCommitAtom);

  const cwd = joinPath(root, relPath);
  const addressPath = [rootLabel(root), ...relPath];

  const openDir = useCallback(
    (absPath: string) => {
      const nextRelPath = relSegments(root, absPath);
      if (joinPath(root, nextRelPath) !== absPath) {
        console.warn(`[navigation] root 外のディレクトリを拒否しました: ${absPath}`);
        return;
      }
      requestCommit("push");
      setDirection(1); // 子へ潜る
      setRelPath(nextRelPath);
      setSelectedPath(absPath);
    },
    [requestCommit, root, setRelPath, setSelectedPath, setDirection],
  );

  const selectFile = useCallback(
    (absPath: string) => {
      const selectedRelPath = relSegments(root, absPath);
      if (joinPath(root, selectedRelPath) !== absPath) {
        console.warn(`[navigation] root 外のファイルを拒否しました: ${absPath}`);
        return;
      }
      // プレビュー対象の変更は同一ディレクトリ内の軽微な選択なので replace する。
      requestCommit("replace");
      setSelectedPath(absPath);
    },
    [requestCommit, root, setSelectedPath],
  );

  const goToSegment = useCallback(
    (index: number) => {
      if (index === relPath.length && selectedPath === null) return;
      requestCommit("push");
      // index 0 = ルート、以降は子 segments。relPath を index 件に切り詰める。
      setDirection(-1); // 親へ遡る
      setRelPath((prev) => prev.slice(0, index));
      setSelectedPath(null);
    },
    [relPath.length, requestCommit, selectedPath, setRelPath, setSelectedPath, setDirection],
  );

  const goUp = useCallback(() => {
    if (relPath.length === 0) return;
    requestCommit("push");
    setDirection(-1);
    setRelPath((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
    setSelectedPath(null);
  }, [relPath.length, requestCommit, setRelPath, setSelectedPath, setDirection]);

  return { root, cwd, relPath, selectedPath, addressPath, openDir, selectFile, goToSegment, goUp };
}
