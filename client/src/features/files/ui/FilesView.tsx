// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// 表示は「現在開いているフォルダー1階層のみ」。子へ潜ると、その時点のカラムは
// 左の受動スタックへ吸い込まれ（exit アニメ）、子のカラムが右からスライドインする。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { browseFs, getScanDiagnostics } from "../api";
import { useFilesNavigation } from "../model/useFilesNavigation";
import { filesDirectionAtom } from "../../../entities/file-system/model/navigationAtoms";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { buildFolderAudioQueue } from "../model/filePlayback";
import { classifyFile } from "../model/types";
import type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";
import {
  playerIsPlayingOrLoadingAtom,
  playingFsPathAtom,
  playingTrackRelPathAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import { rootLabel, type FsEntry } from "../model/types";
import { workspacePath } from "@mimimilli/shared";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import FileColumn from "./FileColumn";
import FilePreview from "./FilePreview";
import StackEdge from "./StackEdge";

interface ColstackBackButtonProps {
  parentName: string;
  depth: number;
  onGoUp: () => void;
}

/** パンくずの「1つ上の階層へ」ボタン。幅方向のcolstack-widthで出入りする。 */
function ColstackBackButton({ parentName, depth, onGoUp }: ColstackBackButtonProps) {
  const { colstackWidth } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = colstackWidth();
  return (
    <motion.button
      type="button"
      className="mle-colstack"
      title={`1つ上の階層（${parentName}）へ戻る`}
      onClick={onGoUp}
      inert={!isPresent}
      {...v}
    >
      <StackEdge parentName={parentName} depth={depth} />
    </motion.button>
  );
}

interface FilesViewProps {
  rootFolder: string;
  onPlayFile: (tracks: PlaybackTrack[], trackIndex: number) => void;
}

export default function FilesView({ rootFolder, onPlayFile }: FilesViewProps) {
  const nav = useFilesNavigation(rootFolder);
  const direction = useAtomValue(filesDirectionAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingRelPath = useAtomValue(playingTrackRelPathAtom);
  const playingFsPath = useAtomValue(playingFsPathAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);

  const cwdQuery = useQuery({
    queryKey: FILE_SYSTEM_QUERY_KEYS.directory(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const cwdEntries = cwdQuery.data?.entries ?? [];
  const diagnosticsQuery = useQuery({
    queryKey: ["scan", "diagnostics"],
    queryFn: getScanDiagnostics,
  });
  const identityConflictPaths = useMemo(
    () =>
      new Map(
        (diagnosticsQuery.data?.diagnostics ?? []).flatMap((diagnostic) =>
          diagnostic.paths.map((path) => [path, diagnostic] as const),
        ),
      ),
    [diagnosticsQuery.data],
  );

  const handlePlayFile = useCallback(
    (entry: FsEntry, folderEntries: FsEntry[]) => {
      if (classifyFile(entry) !== "audio") return;
      const { tracks, trackIndex } = buildFolderAudioQueue(folderEntries, entry);
      if (tracks.length === 0) return;
      onPlayFile(tracks, trackIndex);
    },
    [onPlayFile],
  );

  const matchPlaying = useMemo(
    () => (entry: FsEntry) => {
      if (playingFsPath) return entry.path === playingFsPath;
      return (
        !!playingWorkId &&
        entry.workId === playingWorkId &&
        entry.workRelPath != null &&
        entry.workRelPath === playingRelPath
      );
    },
    [playingFsPath, playingWorkId, playingRelPath],
  );

  const cwdTitle = nav.relPath.slice(-1)[0] ?? rootLabel(rootFolder);
  const parentName = nav.relPath.slice(-2, -1)[0] ?? rootLabel(rootFolder);

  // ── プレビュー対象 ────────────────────────────────────────
  // ファイル選択中はそのファイル、それ以外はカレント dir 自身。
  const cwdFolderEntry: FsEntry = {
    name: cwdTitle,
    path: workspacePath(nav.relPath.join("/")),
    isDir: true,
    size: 0,
    fileType: "dir",
    childCount: cwdEntries.length,
    workId: cwdQuery.data?.workId ?? null,
    workRelPath: null,
    mediaKind: null,
    preview: null,
  };
  const fileSelection =
    nav.selectedPath && nav.selectedPath !== nav.cwd
      ? (cwdEntries.find((e) => e.path === nav.selectedPath) ?? null)
      : null;
  const previewEntry = fileSelection ?? cwdFolderEntry;
  const folderEntries = previewEntry.isDir ? cwdEntries : null;

  const hasAncestors = nav.relPath.length >= 1;

  return (
    <>
      <AnimatePresence initial={false}>
        {hasAncestors && (
          <ColstackBackButton
            key="colstack-back"
            parentName={parentName}
            depth={nav.relPath.length}
            onGoUp={nav.goUp}
          />
        )}
      </AnimatePresence>

      <div className="mle-filestage">
        <div
          key={nav.cwd}
          data-dir={direction >= 0 ? "forward" : "back"}
          className="mle-col mle-filestage__col ml-file-col-enter"
        >
          <FileColumn
            title={cwdTitle}
            entries={cwdEntries}
            identityConflictPaths={identityConflictPaths}
            selectedPath={nav.selectedPath}
            matchPlaying={matchPlaying}
            isPlaybackActive={isPlaybackActive}
            onOpenDir={nav.openDir}
            onSelectFile={nav.selectFile}
            onPlayFile={(entry) => handlePlayFile(entry, cwdEntries)}
            isLoading={cwdQuery.isPending}
            isError={cwdQuery.isError}
            onRetry={() => cwdQuery.refetch()}
          />
        </div>
      </div>

      <FilePreview
        entry={previewEntry}
        folderEntries={folderEntries}
        depth={nav.addressPath.length}
        browsePath={nav.cwd}
        isPlayingEntry={matchPlaying(previewEntry)}
        onPlay={(entry) => handlePlayFile(entry, folderEntries ?? cwdEntries)}
        onWorkRegistered={() => cwdQuery.refetch()}
        identityConflict={identityConflictPaths.get(previewEntry.path) ?? null}
      />
    </>
  );
}
