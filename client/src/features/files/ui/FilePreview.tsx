import type { CSSProperties } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { playerIsPlayingOrLoadingAtom } from "../../../entities/player/model/atoms";
import { useFilePreviewResize } from "../model/useFilePreviewResize";
import { useSingleFileWorkTitle } from "../model/useSingleFileWorkTitle";
import { useFilesBrowse } from "../model/useFilesBrowse";
import { useFilesPlayingMatcher } from "../model/useFilesPlayingMatcher";
import { filesPreviewOpenAtom } from "../model/previewLayoutAtoms";
import { buildFolderAudioQueue } from "../model/filePlayback";
import { EmptyPreview, FileLoadErrorPreview, MissingSelectionPreview } from "./FilePreviewStates";
import { FilePreviewMediaSlot } from "./FilePreviewMedia";
import FilePreviewWorkActions from "./FilePreviewWorkActions";
import type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";
import {
  classifyFile,
  isWorkFolder,
  isSingleFileWork,
  summarizeKinds,
  FILE_KIND_LABEL,
  type FsEntry,
} from "../model/types";

interface FilePreviewProps {
  onPlayFile: (tracks: PlaybackTrack[], trackIndex: number) => void;
  /** 再生中のエントリの一時停止・再開を切り替える（先頭からの再生し直しをしない） */
  onTogglePlay: () => void;
}

export default function FilePreview({ onPlayFile, onTogglePlay }: FilePreviewProps) {
  const root = useRootFolder() ?? "/";
  const browse = useFilesBrowse(root);
  const matchPlaying = useFilesPlayingMatcher();
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const setPreviewOpen = useSetAtom(filesPreviewOpenAtom);
  const { width, anchorRef, onResizePointerDown, onResizePointerMove, onResizePointerUp } =
    useFilePreviewResize();

  const {
    previewEntry: entry,
    folderEntries,
    playbackSourceEntries,
    loadError,
    missingSelectionPath,
    hasAncestors,
    nav,
  } = browse;

  const kind = entry ? classifyFile(entry) : null;
  const isDir = kind === "dir";
  const label = isDir
    ? "フォルダー · 物理"
    : kind
      ? `${FILE_KIND_LABEL[kind]} · 物理`
      : "プレビュー";
  const audioFiles = folderEntries ? folderEntries.filter((e) => classifyFile(e) === "audio") : [];
  const firstAudioFile = audioFiles[0];
  const breakdown = folderEntries ? summarizeKinds(folderEntries) : [];
  const isWorkFolderEntry = !!entry && isWorkFolder(entry);
  const isSingleFileWorkEntry = !!entry && isSingleFileWork(entry);
  // フォルダー単位・単一ファイル単位を問わず「作品として登録済みか」。HeroのisWorkFolder
  // 引数名はフォルダー単位限定の既存の意味のまま変えず、ここでは呼び出し側の値として
  // 明確な名前を持たせる。
  const isRegisteredWork = isWorkFolderEntry || isSingleFileWorkEntry;

  const workTitle = useSingleFileWorkTitle(entry && isSingleFileWork(entry) ? entry.workId : null);

  const isPlayingEntry = entry != null && matchPlaying(entry);
  const playEntry = (target: FsEntry, entries: FsEntry[]) => {
    if (classifyFile(target) !== "audio") return;
    const { tracks, trackIndex } = buildFolderAudioQueue(entries, target);
    if (tracks.length === 0) return;
    onPlayFile(tracks, trackIndex);
  };

  // 再生中エントリを押し直すと先頭から掛け直されてしまうため、
  // ロード済みのときはトグル（一時停止・再開）にする。再生位置を変えない。
  const isLoadedEntry = kind === "audio" && isPlayingEntry;
  const playActions =
    kind === "audio" ? (
      <Button
        variant="primary"
        icon={isLoadedEntry ? (isPlaybackActive ? I.pause : I.play) : I.play}
        onClick={() => (isLoadedEntry ? onTogglePlay() : playEntry(entry!, playbackSourceEntries))}
      >
        {isLoadedEntry ? (isPlaybackActive ? "一時停止" : "再開") : "このファイルを再生"}
      </Button>
    ) : isDir && firstAudioFile ? (
      <Button
        variant="primary"
        icon={I.play}
        onClick={() => playEntry(firstAudioFile, playbackSourceEntries)}
      >
        先頭の音声を再生
      </Button>
    ) : null;

  return (
    <div
      ref={anchorRef}
      className="mle-prv-anchor is-files"
      style={{ "--files-prv-w": `${width}px` } as CSSProperties}
    >
      <button
        type="button"
        className="mle-prv__close"
        aria-label="プレビューを閉じる"
        title="プレビューを閉じる"
        onClick={() => setPreviewOpen(false)}
      >
        <I.chev size={14} />
      </button>
      <div
        className="mle-prv__resize"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hr は静的な区切り線の意味しか持たない。ここはドラッグでプレビュー幅を変えるsplitter（WAI-ARIA window-splitterパターン）なのでrole="separator"を使う
        role="separator"
        aria-orientation="vertical"
        aria-label="プレビュー幅"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
      {/* ドラッグでの幅変更のみ対応。キーボード操作は未対応 */}

      <div className="mle-prv is-files">
        {loadError ? (
          <FileLoadErrorPreview
            kind={loadError}
            path={nav.cwd}
            hasAncestors={hasAncestors}
            onGoUp={nav.goUp}
            onGoRoot={() => nav.goToSegment(0)}
            onRetry={browse.refetchCwd}
          />
        ) : missingSelectionPath ? (
          <MissingSelectionPreview path={missingSelectionPath} onBack={nav.clearSelection} />
        ) : (
          <>
            <div className="mle-prv__hd">
              <span className="label">{label}</span>
              {entry && (
                <span className="pill" style={{ marginLeft: "auto" }}>
                  {isDir ? `深さ ${nav.addressPath.length} 階層` : kind?.toUpperCase()}
                </span>
              )}
            </div>

            <div className="mle-prv__body">
              {!entry ? (
                <EmptyPreview />
              ) : (
                <div className="mle-fprev">
                  <FilePreviewMediaSlot
                    entry={entry}
                    isDir={isDir}
                    kind={kind!}
                    isRegisteredWork={isRegisteredWork}
                    breakdown={breakdown}
                    workTitle={workTitle}
                  />

                  <FilePreviewWorkActions
                    entry={entry}
                    playActions={playActions}
                    onWorkRegistered={browse.refetchCwd}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
