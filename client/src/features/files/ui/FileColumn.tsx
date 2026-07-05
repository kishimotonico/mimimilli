// カラムの中身（ヘッダー + 行リスト）。外側の .mle-col 枠と出入りアニメーションは
// FilesView 側の motion.div が担うため、ここはフラグメントを返す。

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
}

export default function FileColumn({
  title, entries, selectedPath, matchPlaying, isPlaybackActive,
  onOpenDir, onSelectFile, onPlayFile, isLoading,
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
          <Empty message="読み込み中..." />
        ) : sorted.length === 0 ? (
          <Empty message="空のフォルダー" />
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
      </div>
    </>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "var(--ink-4)", fontSize: 12 }}>
      {message}
    </div>
  );
}
