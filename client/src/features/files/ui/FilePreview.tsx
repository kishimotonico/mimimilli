import type { CSSProperties } from "react";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { useFilePreviewResize } from "../model/useFilePreviewResize";
import { useSingleFileWorkTitle } from "../model/useSingleFileWorkTitle";
import { EmptyPreview, FileLoadErrorPreview, MissingSelectionPreview } from "./FilePreviewStates";
import { FilePreviewMediaSlot } from "./FilePreviewMedia";
import FilePreviewWorkActions from "./FilePreviewWorkActions";
import type { ScanDiagnostic } from "@mimimilli/shared";
import {
  classifyFile,
  summarizeKinds,
  FILE_KIND_LABEL,
  type FileLoadError,
  type FsEntry,
} from "../model/types";

interface FilePreviewProps {
  /** 選択中エントリ（ファイル or dir）。loadError があるときは null */
  entry: FsEntry | null;
  /** entry が dir のときその直下エントリ（種別内訳・全wav再生に使用） */
  folderEntries: FsEntry[] | null;
  /** 物理階層の深さ（パンくず段数） */
  depth: number;
  /** 現在開いているディレクトリ（FS キャッシュ無効化用） */
  browsePath: string;
  isPlayingEntry: boolean;
  isPlaybackActive: boolean;
  onPlay: (entry: FsEntry) => void;
  /** 再生中のエントリの一時停止・再開を切り替える（先頭からの再生し直しをしない） */
  onTogglePlay: () => void;
  /** 作品登録・解除後にファイル一覧を再取得する */
  onWorkRegistered?: () => void | Promise<unknown>;
  identityConflict: ScanDiagnostic | null;
  loadError: FileLoadError | null;
  onRetryLoad: () => void;
  hasAncestors: boolean;
  onGoUp: () => void;
  onGoRoot: () => void;
  /** ディレクトリ自体は取得できたが選択中パスがその中に無いとき、そのパス（ライブラリの
   *  エラー詳細・スキャン要対応からの「Filesで開く」で移動・削除済みの対象を指したときに
   *  発生する） */
  missingSelectionPath: string | null;
  /** missingSelectionPath の表示から、選択を外してカレントフォルダーの表示へ戻る */
  onClearSelection: () => void;
  onClose: () => void;
}

export default function FilePreview({
  entry,
  folderEntries,
  depth,
  browsePath,
  isPlayingEntry,
  isPlaybackActive,
  onPlay,
  onTogglePlay,
  onWorkRegistered,
  identityConflict,
  loadError,
  onRetryLoad,
  hasAncestors,
  onGoUp,
  onGoRoot,
  missingSelectionPath,
  onClearSelection,
  onClose,
}: FilePreviewProps) {
  const { width, anchorRef, onResizePointerDown, onResizePointerMove, onResizePointerUp } =
    useFilePreviewResize();

  const kind = entry ? classifyFile(entry) : null;
  const isDir = kind === "dir";
  const label = isDir
    ? "フォルダー · 物理"
    : kind
      ? `${FILE_KIND_LABEL[kind]} · 物理`
      : "プレビュー";
  const audioFiles = isDir ? (folderEntries ?? []).filter((e) => classifyFile(e) === "audio") : [];
  const firstAudioFile = audioFiles[0];
  const breakdown = isDir && folderEntries ? summarizeKinds(folderEntries) : [];
  const isWorkFolder = isDir && !!entry?.workId;
  const isSingleFileWork =
    !isDir && !!entry?.workId && (entry.workRelPath === "" || entry.workRelPath === ".");
  // フォルダー単位・単一ファイル単位を問わず「作品として登録済みか」。HeroのisWorkFolder
  // 引数名はフォルダー単位限定の既存の意味のまま変えず、ここでは呼び出し側の値として
  // 明確な名前を持たせる。
  const isRegisteredWork = isWorkFolder || isSingleFileWork;

  const workTitle = useSingleFileWorkTitle(isSingleFileWork ? (entry?.workId ?? null) : null);

  // 再生中エントリを押し直すと先頭から掛け直されてしまうため、
  // ロード済みのときはトグル（一時停止・再開）にする。再生位置を変えない。
  const isLoadedEntry = kind === "audio" && isPlayingEntry;
  const playActions =
    kind === "audio" ? (
      <Button
        variant="primary"
        icon={isLoadedEntry ? (isPlaybackActive ? I.pause : I.play) : I.play}
        onClick={() => (isLoadedEntry ? onTogglePlay() : onPlay(entry!))}
      >
        {isLoadedEntry ? (isPlaybackActive ? "一時停止" : "再開") : "このファイルを再生"}
      </Button>
    ) : isDir && firstAudioFile ? (
      <Button variant="primary" icon={I.play} onClick={() => onPlay(firstAudioFile)}>
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
        onClick={onClose}
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
            path={browsePath}
            hasAncestors={hasAncestors}
            onGoUp={onGoUp}
            onGoRoot={onGoRoot}
            onRetry={onRetryLoad}
          />
        ) : missingSelectionPath ? (
          <MissingSelectionPreview path={missingSelectionPath} onBack={onClearSelection} />
        ) : (
          <>
            <div className="mle-prv__hd">
              <span className="label">{label}</span>
              {entry && (
                <span className="pill" style={{ marginLeft: "auto" }}>
                  {isDir ? `深さ ${depth} 階層` : kind?.toUpperCase()}
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
                    isDir={isDir}
                    kind={kind!}
                    browsePath={browsePath}
                    isWorkFolder={isWorkFolder}
                    isSingleFileWork={isSingleFileWork}
                    identityConflict={identityConflict}
                    playActions={playActions}
                    onWorkRegistered={onWorkRegistered}
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
