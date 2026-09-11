// FilesView: ファイルモード = 物理ファイルシステムのファイラー。
// 表示は「現在開いているフォルダー1階層のみ」。子へ潜ると、その時点のカラムは
// 左の受動スタックへ吸い込まれ（exit アニメ）、子のカラムが右からスライドインする。
// 階層を遡るのはパンくず（アドレスバー）のみ。再生エンジンは Library と共通・常駐。

import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useFilesBrowse } from "../model/useFilesBrowse";
import { useFilesPlayingMatcher } from "../model/useFilesPlayingMatcher";
import { useIdentityConflictMap } from "../model/useIdentityConflict";
import { filesDirectionAtom } from "../../../entities/file-system/model/navigationAtoms";
import { buildFolderAudioQueue } from "../model/filePlayback";
import { classifyFile, rootLabel, type FsEntry } from "../model/types";
import { filesPreviewOpenAtom } from "../model/previewLayoutAtoms";
import type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";
import { playerIsPlayingOrLoadingAtom } from "../../../entities/player/model/atoms";
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
  onTogglePlay: () => void;
}

export default function FilesView({ rootFolder, onPlayFile, onTogglePlay }: FilesViewProps) {
  const browse = useFilesBrowse(rootFolder);
  const { nav } = browse;
  const direction = useAtomValue(filesDirectionAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const [previewOpen, setPreviewOpen] = useAtom(filesPreviewOpenAtom);
  const matchPlaying = useFilesPlayingMatcher();
  const identityConflictPaths = useIdentityConflictMap();

  const handlePlayFile = useCallback(
    (entry: FsEntry, folderEntries: FsEntry[]) => {
      if (classifyFile(entry) !== "audio") return;
      const { tracks, trackIndex } = buildFolderAudioQueue(folderEntries, entry);
      if (tracks.length === 0) return;
      onPlayFile(tracks, trackIndex);
    },
    [onPlayFile],
  );

  // プレビューが閉じている間に別のエントリを選ぶ／フォルダーへ潜ったときは、
  // 見たい対象があるという意思表示なので自動的に開き直す。
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

  return (
    <>
      <AnimatePresence initial={false}>
        {browse.hasAncestors && (
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
              entries={browse.entries}
              identityConflictPaths={identityConflictPaths}
              selectedPath={nav.selectedPath}
              matchPlaying={matchPlaying}
              isPlaybackActive={isPlaybackActive}
              onOpenDir={openDir}
              onSelectFile={selectFile}
              onFocusEntry={selectFile}
              onPlayFile={(entry) => handlePlayFile(entry, browse.entries)}
              isLoading={browse.isPending}
              isError={browse.isError}
              notFound={browse.notFound}
              onRetry={browse.refetchCwd}
            />
          </div>
        </div>

        {previewOpen && <FilePreview onPlayFile={onPlayFile} onTogglePlay={onTogglePlay} />}
      </div>
    </>
  );
}
