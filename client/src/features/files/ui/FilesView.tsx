// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// 表示は「現在開いているフォルダー1階層のみ」。子へ潜ると、その時点のカラムは
// 左の受動スタックへ吸い込まれ（exit アニメ）、子のカラムが右からスライドインする。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { browseFs } from "../api";
import { useFilesNavigation } from "../model/useFilesNavigation";
import { filesDirectionAtom } from "../model/atoms";
import {
  playerIsPlaybackActiveAtom,
  playingTrackRelPathAtom,
  playingWorkIdAtom,
} from "../../player/model/atoms";
import { rootLabel, type FsEntry } from "../model/types";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import Presence from "../../../shared/ui/Presence";
import FileColumn from "./FileColumn";
import FilePreview from "./FilePreview";
import StackEdge from "./StackEdge";

interface FilesViewProps {
  rootFolder: string;
  onPlayFile: (entry: FsEntry) => void;
}

export default function FilesView({ rootFolder, onPlayFile }: FilesViewProps) {
  const nav = useFilesNavigation(rootFolder);
  const direction = useAtomValue(filesDirectionAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingRelPath = useAtomValue(playingTrackRelPathAtom);
  const isPlaybackActive = useAtomValue(playerIsPlaybackActiveAtom);

  const cwdQuery = useQuery({
    queryKey: FILE_SYSTEM_QUERY_KEYS.directory(nav.cwd),
    queryFn: () => browseFs(nav.cwd),
  });
  const cwdEntries = cwdQuery.data?.entries ?? [];

  const matchPlaying = useMemo(
    () => (entry: FsEntry) =>
      !!playingWorkId &&
      entry.workId === playingWorkId &&
      entry.workRelPath != null &&
      entry.workRelPath === playingRelPath,
    [playingWorkId, playingRelPath],
  );

  const cwdTitle = nav.relPath.slice(-1)[0] ?? rootLabel(rootFolder);
  const parentName = nav.relPath.slice(-2, -1)[0] ?? rootLabel(rootFolder);

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
      ? (cwdEntries.find((e) => e.path === nav.selectedPath) ?? null)
      : null;
  const previewEntry = fileSelection ?? cwdFolderEntry;
  const folderEntries = previewEntry.isDir ? cwdEntries : null;

  const hasAncestors = nav.relPath.length >= 1;

  return (
    <>
      <Presence
        show={hasAncestors}
        as="button"
        type="button"
        variant="colstack-width"
        skipInitial
        className="mle-colstack"
        title={`1つ上の階層（${parentName}）へ戻る`}
        onClick={nav.goUp}
      >
        <StackEdge parentName={parentName} depth={nav.relPath.length} />
      </Presence>

      <div className="mle-filestage">
        <div
          key={nav.cwd}
          data-dir={direction >= 0 ? "forward" : "back"}
          className="mle-col mle-filestage__col ml-file-col-enter"
        >
          <FileColumn
            title={cwdTitle}
            entries={cwdEntries}
            selectedPath={nav.selectedPath}
            matchPlaying={matchPlaying}
            isPlaybackActive={isPlaybackActive}
            onOpenDir={nav.openDir}
            onSelectFile={nav.selectFile}
            onPlayFile={onPlayFile}
            isLoading={cwdQuery.isPending}
          />
        </div>
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
