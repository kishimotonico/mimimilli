// カラムの中身（ヘッダー + 行リスト）。外側の .mle-col 枠と出入りアニメーションは
// FilesView 側の motion.div が担うため、ここはフラグメントを返す。

import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import CollectionStatus from "../../library/ui/CollectionStatus";
import { classifyFile, sortEntries, type FsEntry } from "../model/types";
import FileRow from "./FileRow";

interface FileColumnProps {
  title: string;
  entries: FsEntry[];
  selectedPath: string | null;
  matchPlaying: (entry: FsEntry) => boolean;
  isPlaybackActive?: boolean;
  onOpenDir: (absPath: string) => void;
  onSelectFile: (absPath: string) => void;
  onPlayFile: (entry: FsEntry) => void;
  isLoading?: boolean;
  /** フォルダー一覧取得の失敗。無言で「空のフォルダー」にせず区別する */
  isError?: boolean;
  onRetry?: () => void;
}

export default function FileColumn({
  title,
  entries,
  selectedPath,
  matchPlaying,
  isPlaybackActive,
  onOpenDir,
  onSelectFile,
  onPlayFile,
  isLoading,
  isError,
  onRetry,
}: FileColumnProps) {
  const sorted = sortEntries(entries);
  return (
    <>
      <div className="mle-col__hd">
        <span>{title}</span>
        <span className="count">{entries.length}</span>
      </div>
      <div className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
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
              sorted.map((entry) => {
                const onClick = () =>
                  entry.isDir ? onOpenDir(entry.path) : onSelectFile(entry.path);
                const onActivate = () => {
                  if (entry.isDir) onOpenDir(entry.path);
                  else if (classifyFile(entry) === "audio") onPlayFile(entry);
                  else onSelectFile(entry.path);
                };
                return (
                  <FileRow
                    key={entry.path}
                    entry={entry}
                    isFocused={entry.path === selectedPath}
                    isPlaying={matchPlaying(entry)}
                    isPlaybackActive={isPlaybackActive}
                    onClick={onClick}
                    onActivate={onActivate}
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
