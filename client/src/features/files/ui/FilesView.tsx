// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// 表示は「現在開いているフォルダー1階層のみ」。子へ潜ると、その時点のカラムは
// 左の受動スタックへ吸い込まれ（exit アニメ）、子のカラムが右からスライドインする。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useAtomValue } from "jotai";
import { browseFs } from "../api";
import { useFilesNavigation } from "../model/useFilesNavigation";
import { filesDirectionAtom } from "../model/atoms";
import { rootLabel, type FsEntry } from "../model/types";
import FileColumn from "./FileColumn";
import FilePreview from "./FilePreview";
import StackEdge from "./StackEdge";

export const FILES_KEYS = {
  dir: (path: string) => ["fs", path] as const,
};

// transformOrigin は左端（=スタック側）。子へ潜るとき、出ていくカラムは
// 横方向に潰れながら左へ寄り、背表紙へ収束する。遡上時は背表紙から開き直す。
const colVariants = {
  enter: (dir: number) =>
    dir >= 0
      ? { x: "60%", opacity: 0, scaleX: 1, scaleY: 1 }
      : { x: "-8%", opacity: 0, scaleX: 0.28, scaleY: 0.94 },
  center: {
    x: "0%", opacity: 1, scaleX: 1, scaleY: 1,
    transition: { type: "spring" as const, stiffness: 460, damping: 38, mass: 0.8 },
  },
  exit: (dir: number) =>
    dir >= 0
      ? {
          x: "-6%", opacity: 0, scaleX: 0.05, scaleY: 0.86,
          transition: { duration: 0.4, ease: [0.55, 0, 0.35, 1] as const },
        }
      : {
          x: "75%", opacity: 0, scaleX: 0.92,
          transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] as const },
        },
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
  const direction = useAtomValue(filesDirectionAtom);

  const cwdQuery = useQuery({
    queryKey: FILES_KEYS.dir(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const cwdEntries = cwdQuery.data?.entries ?? [];

  const matchPlaying = useMemo(
    () => (entry: FsEntry) =>
      !!playingWorkId && entry.workId === playingWorkId && entry.workRelPath != null && entry.workRelPath === playingRelPath,
    [playingWorkId, playingRelPath]
  );

  const cwdTitle = nav.relPath.length > 0 ? nav.relPath[nav.relPath.length - 1] : rootLabel(rootFolder);
  const parentName = nav.relPath.length >= 2 ? nav.relPath[nav.relPath.length - 2] : rootLabel(rootFolder);

  // ── プレビュー対象 ────────────────────────────────────────
  // ファイル選択中はそのファイル、それ以外はカレント dir 自身。
  const cwdFolderEntry: FsEntry = {
    name: cwdTitle,
    path: nav.cwd,
    isDir: true,
    size: 0,
    fileType: "dir",
    childCount: cwdEntries.length,
    workId: cwdQuery.data?.workId ?? null,
    workRelPath: null,
  };
  const fileSelection =
    nav.selectedPath && nav.selectedPath !== nav.cwd
      ? cwdEntries.find((e) => e.path === nav.selectedPath) ?? null
      : null;
  const previewEntry = fileSelection ?? cwdFolderEntry;
  const folderEntries = previewEntry.isDir ? cwdEntries : null;

  const hasAncestors = nav.relPath.length >= 1;

  return (
    <>
      <AnimatePresence initial={false}>
        {hasAncestors && (
          <StackEdge key="stack" parentName={parentName} depth={nav.relPath.length} onUp={nav.goUp} />
        )}
      </AnimatePresence>

      <div className="mle-filestage">
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={nav.cwd}
            className="mle-col is-wide mle-filestage__col"
            custom={direction}
            variants={colVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ transformOrigin: "left center" }}
          >
            <FileColumn
              title={cwdTitle}
              entries={cwdEntries}
              selectedPath={nav.selectedPath}
              matchPlaying={matchPlaying}
              onOpenDir={nav.openDir}
              onSelectFile={nav.selectFile}
              onPlayFile={onPlayFile}
              isLoading={cwdQuery.isPending}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <FilePreview
        entry={previewEntry}
        folderEntries={folderEntries}
        depth={nav.addressPath.length}
        isPlayingEntry={matchPlaying(previewEntry)}
        onPlay={onPlayFile}
      />
    </>
  );
}
