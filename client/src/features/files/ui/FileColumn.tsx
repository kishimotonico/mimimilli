// カラムの中身（ヘッダー + 行リスト）。外側の .mle-col 枠と出入りアニメーションは
// FilesView 側の motion.div が担うため、ここはフラグメントを返す。

import { useRef } from "react";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { classifyFile, sortEntries, type FsEntry } from "../model/types";
import type { WorkspacePath } from "@mimimilli/shared";
import type { ScanDiagnostic } from "@mimimilli/shared";
import FileRow from "./FileRow";
import { useFileListKeyboardNav } from "./useFileListKeyboardNav";

interface FileColumnProps {
  title: string;
  entries: FsEntry[];
  identityConflictPaths: ReadonlyMap<string, ScanDiagnostic>;
  selectedPath: WorkspacePath | null;
  matchPlaying: (entry: FsEntry) => boolean;
  isPlaybackActive?: boolean;
  onOpenDir: (absPath: WorkspacePath) => void;
  onSelectFile: (absPath: WorkspacePath) => void;
  /** 矢印キーでの行移動。クリックと違いフォルダーへは潜らず、プレビュー対象を移すだけ
   *  （作品一覧の矢印キー移動が選択を追従させるのと同じ規則） */
  onFocusEntry: (absPath: WorkspacePath) => void;
  onPlayFile: (entry: FsEntry, folderEntries: FsEntry[]) => void;
  isLoading?: boolean;
  /** フォルダー一覧取得の失敗。無言で「空のフォルダー」にせず区別する */
  isError?: boolean;
  /** 404（対象フォルダーが存在しない）。再試行しても直らないため isError と表示を分ける */
  notFound?: boolean;
  onRetry?: () => void;
}

export default function FileColumn({
  title,
  entries,
  identityConflictPaths,
  selectedPath,
  matchPlaying,
  isPlaybackActive,
  onOpenDir,
  onSelectFile,
  onFocusEntry,
  onPlayFile,
  isLoading,
  isError,
  notFound,
  onRetry,
}: FileColumnProps) {
  const sorted = sortEntries(entries);
  const listRef = useRef<HTMLDivElement>(null);
  const moveRowFocus = useFileListKeyboardNav({
    listRef,
    entries: sorted,
    onFocusEntry,
  });
  // roving tabindexの現在位置。選択中エントリがあればその位置、無ければ先頭（0）を
  // 対象にする（一覧全体でTabストップ1個、作品一覧と同じ規則。仮想化していないため
  // useRovingIndexの描画範囲フォールバックは不要）。
  const selectedIndex = sorted.findIndex((entry) => entry.path === selectedPath);
  const rovingIndex = sorted.length === 0 ? -1 : selectedIndex >= 0 ? selectedIndex : 0;
  return (
    <>
      <div className="mle-col__hd">
        <span>{title}</span>
        <span className="count">{entries.length}</span>
      </div>
      <div ref={listRef} className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : notFound ? (
          // 404は再試行しても直らないため、再試行ボタンを出さない（TASK-428.18）。
          <CollectionStatus variant="list" kind="empty" message="このフォルダーは見つかりません" />
        ) : isError && entries.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
        ) : (
          <>
            {/* 再取得の失敗でもReact Queryはキャッシュ済みのentriesを保持したまま
                isError=trueになる。キャッシュがある場合は一覧を残し、非ブロッキングの
                エラー行＋再試行だけを出す（ContentColumnのファセット軸と同じパターン）。 */}
            {isError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ContentColumnの分類軸エラーと同様、role="status"で非ブロッキング通知にする
              <div className="mll-axis-error" role="status" aria-live="polite">
                <span>フォルダー一覧の取得に失敗しました</span>
                {onRetry && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetry}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {sorted.length === 0 ? (
              <CollectionStatus variant="list" kind="empty" message="空のフォルダー" />
            ) : (
              sorted.map((entry, index) => {
                const onClick = () =>
                  entry.isDir ? onOpenDir(entry.path) : onSelectFile(entry.path);
                const onActivate = () => {
                  if (entry.isDir) onOpenDir(entry.path);
                  else if (classifyFile(entry) === "audio") onPlayFile(entry, entries);
                  else onSelectFile(entry.path);
                };
                return (
                  <FileRow
                    key={entry.path}
                    entry={entry}
                    flatIndex={index}
                    tabIndex={index === rovingIndex ? 0 : -1}
                    identityConflict={identityConflictPaths.get(entry.path) ?? null}
                    isFocused={entry.path === selectedPath}
                    isPlaying={matchPlaying(entry)}
                    isPlaybackActive={isPlaybackActive}
                    onClick={onClick}
                    onActivate={onActivate}
                    onArrowKey={moveRowFocus}
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </>
  );
}
