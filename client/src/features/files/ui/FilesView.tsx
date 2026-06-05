// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// ルートフォルダー起点で実ディレクトリを巡回する。深い階層でもカラムを増やさず、
// 末尾2階層（親 + カレント）+ プレビューだけ全幅を保ち、それ以前は受動スタックに畳む。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { browseFs } from "../api";
import { useFilesNavigation } from "../model/useFilesNavigation";
import { joinPath, rootLabel, type FsEntry } from "../model/types";
import FileColumn from "./FileColumn";
import FilePreview from "./FilePreview";
import StackEdge from "./StackEdge";

export const FILES_KEYS = {
  dir: (path: string) => ["fs", path] as const,
};

interface FilesViewProps {
  rootFolder: string;
  /** 再生中の作品 ID */
  playingWorkId?: string;
  /** 再生中トラックの作品相対パス（= FsEntry.workRelPath と突合） */
  playingRelPath?: string | null;
  onPlayFile: (entry: FsEntry) => void;
}

export default function FilesView({ rootFolder, playingWorkId, playingRelPath, onPlayFile }: FilesViewProps) {
  const nav = useFilesNavigation(rootFolder);

  const parentAbs = nav.relPath.length > 0 ? joinPath(rootFolder, nav.relPath.slice(0, -1)) : null;

  const cwdQuery = useQuery({
    queryKey: FILES_KEYS.dir(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const parentQuery = useQuery({
    queryKey: FILES_KEYS.dir(parentAbs ?? ""),
    queryFn: () => browseFs(parentAbs!),
    enabled: parentAbs !== null,
  });

  const cwdEntries = cwdQuery.data?.entries ?? [];
  const parentEntries = parentQuery.data?.entries ?? [];

  const matchPlaying = useMemo(
    () => (entry: FsEntry) =>
      !!playingWorkId && entry.workId === playingWorkId && entry.workRelPath != null && entry.workRelPath === playingRelPath,
    [playingWorkId, playingRelPath]
  );

  // ── プレビュー対象の解決 ──────────────────────────────────
  const previewEntry: FsEntry | null = useMemo(() => {
    if (nav.selectedPath) {
      return (
        cwdEntries.find((e) => e.path === nav.selectedPath) ??
        parentEntries.find((e) => e.path === nav.selectedPath) ??
        null
      );
    }
    // 未選択: カレント dir そのものを表示（ルートでは親に存在しないため null）
    return parentEntries.find((e) => e.path === nav.cwd) ?? null;
  }, [nav.selectedPath, nav.cwd, cwdEntries, parentEntries]);

  const folderEntries =
    previewEntry && previewEntry.isDir && previewEntry.path === nav.cwd ? cwdEntries : null;

  const cwdTitle = nav.relPath.length > 0 ? nav.relPath[nav.relPath.length - 1] : rootLabel(rootFolder);
  const parentTitle = nav.relPath.length >= 2 ? nav.relPath[nav.relPath.length - 2] : rootLabel(rootFolder);

  return (
    <>
      <div className="mle-cols">
        {/* 末尾2階層より前の祖先は受動スタックに畳む */}
        {nav.relPath.length >= 2 && <StackEdge />}

        {parentAbs !== null && (
          <FileColumn
            title={parentTitle}
            entries={parentEntries}
            activeAncestorPath={nav.cwd}
            selectedPath={nav.selectedPath}
            matchPlaying={matchPlaying}
            onOpenDir={nav.openDir}
            onSelectFile={nav.selectFile}
            onPlayFile={onPlayFile}
            isLoading={parentQuery.isPending}
          />
        )}

        <FileColumn
          title={cwdTitle}
          entries={cwdEntries}
          activeAncestorPath={null}
          selectedPath={nav.selectedPath}
          matchPlaying={matchPlaying}
          onOpenDir={nav.openDir}
          onSelectFile={nav.selectFile}
          onPlayFile={onPlayFile}
          isLoading={cwdQuery.isPending}
        />
      </div>

      <FilePreview
        entry={previewEntry}
        folderEntries={folderEntries}
        depth={nav.addressPath.length}
        isPlayingEntry={previewEntry != null && matchPlaying(previewEntry)}
        onPlay={onPlayFile}
      />
    </>
  );
}
