// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// 表示は「現在開いているフォルダー1階層のみ」。子へ潜ると、その時点のカラムは
// 左の受動スタックへ吸い込まれ（exit アニメ）、子のカラムが右からスライドインする。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { browseFs, getScanDiagnostics } from "../api";
import { useFilesNavigation } from "../model/useFilesNavigation";
import { filesDirectionAtom } from "../../../entities/file-system/model/navigationAtoms";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { SCAN_QUERY_KEYS } from "../../../entities/scan/queryKeys";
import { buildFolderAudioQueue } from "../model/filePlayback";
import { classifyFile } from "../model/types";
import { filesPreviewOpenAtom } from "../model/previewLayoutAtoms";
import { ApiRequestError } from "../../../shared/api/http";
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
import FilePreview, { type FileLoadError } from "./FilePreview";
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
  onTogglePlay: () => void;
}

export default function FilesView({ rootFolder, onPlayFile, onTogglePlay }: FilesViewProps) {
  const nav = useFilesNavigation(rootFolder);
  const direction = useAtomValue(filesDirectionAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingRelPath = useAtomValue(playingTrackRelPathAtom);
  const playingFsPath = useAtomValue(playingFsPathAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const [previewOpen, setPreviewOpen] = useAtom(filesPreviewOpenAtom);

  const cwdQuery = useQuery({
    queryKey: FILE_SYSTEM_QUERY_KEYS.directory(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const cwdEntries = cwdQuery.data?.entries ?? [];
  const cwdNotFound = cwdQuery.error instanceof ApiRequestError && cwdQuery.error.status === 404;
  const loadError: FileLoadError | null = !cwdQuery.isError
    ? null
    : cwdNotFound
      ? "notFound"
      : "error";

  const diagnosticsQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.diagnostics(),
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

  // プレビューが閉じている間に別のエントリを選ぶ／フォルダーへ潜ったときは、
  // 見たい対象があるという意思表示なので自動的に開き直す（files-A-06）。
  const { openDir: navOpenDir, selectFile: navSelectFile } = nav;
  const openDir = useCallback(
    (path: Parameters<typeof navOpenDir>[0]) => {
      setPreviewOpen(true);
      navOpenDir(path);
    },
    [navOpenDir, setPreviewOpen],
  );
  const selectFile = useCallback(
    (path: Parameters<typeof navSelectFile>[0]) => {
      setPreviewOpen(true);
      navSelectFile(path);
    },
    [navSelectFile, setPreviewOpen],
  );

  const cwdTitle = nav.relPath.slice(-1)[0] ?? rootLabel(rootFolder);
  const parentName = nav.relPath.slice(-2, -1)[0] ?? rootLabel(rootFolder);

  // ── プレビュー対象 ────────────────────────────────────────
  // ファイル選択中はそのファイル、それ以外はカレント dir 自身。
  // cwd取得に失敗している間は、実在確認できていないエントリを合成表示しない（files-A-01）。
  const cwdFolderEntry: FsEntry | null = loadError
    ? null
    : {
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
  const hasSelection = !loadError && nav.selectedPath != null && nav.selectedPath !== nav.cwd;
  const fileSelection = hasSelection
    ? (cwdEntries.find((e) => e.path === nav.selectedPath) ?? null)
    : null;
  // ディレクトリ自体は正常に取得できたが、選択中パスがその中に存在しない
  // （ライブラリのエラー詳細・スキャン要対応の「Filesで開く」で移動・削除済みの対象を
  // 指すことがある）。この場合もフォルダーへ黙って差し替えず、対象なしを表示する
  // （openPathInFilesAtom経由での到達を含む。TASK-428.18）。
  const selectionMissing = hasSelection && !cwdQuery.isPending && fileSelection == null;
  const previewEntry = selectionMissing ? null : (fileSelection ?? cwdFolderEntry);
  const folderEntries = previewEntry?.isDir ? cwdEntries : null;

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

      <div className="mle-files-layout" data-preview-open={previewOpen}>
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
              onOpenDir={openDir}
              onSelectFile={selectFile}
              onPlayFile={(entry) => handlePlayFile(entry, cwdEntries)}
              isLoading={cwdQuery.isPending}
              isError={cwdQuery.isError}
              notFound={cwdNotFound}
              onRetry={() => cwdQuery.refetch()}
            />
          </div>
        </div>

        {previewOpen && (
          <FilePreview
            entry={previewEntry}
            folderEntries={folderEntries}
            depth={nav.addressPath.length}
            browsePath={nav.cwd}
            rootFolder={rootFolder}
            isPlayingEntry={previewEntry != null && matchPlaying(previewEntry)}
            isPlaybackActive={isPlaybackActive}
            onPlay={(entry) => handlePlayFile(entry, folderEntries ?? cwdEntries)}
            onTogglePlay={onTogglePlay}
            onWorkRegistered={() => cwdQuery.refetch()}
            identityConflict={
              previewEntry ? (identityConflictPaths.get(previewEntry.path) ?? null) : null
            }
            loadError={loadError}
            onRetryLoad={() => cwdQuery.refetch()}
            hasAncestors={hasAncestors}
            onGoUp={nav.goUp}
            onGoRoot={() => nav.goToSegment(0)}
            missingSelectionPath={selectionMissing ? nav.selectedPath : null}
            onClearSelection={() => selectFile(nav.cwd)}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </div>
    </>
  );
}
