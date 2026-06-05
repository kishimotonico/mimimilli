import { classifyFile, sortEntries, type FsEntry } from "../model/types";
import FileRow from "./FileRow";

interface FileColumnProps {
  title: string;
  entries: FsEntry[];
  /** このカラムで「開かれている子」の絶対パス（親カラムで cwd を示す）。無ければ null */
  activeAncestorPath: string | null;
  selectedPath: string | null;
  /** 再生中エントリの判定 */
  matchPlaying: (entry: FsEntry) => boolean;
  onOpenDir: (absPath: string) => void;
  onSelectFile: (absPath: string) => void;
  onPlayFile: (entry: FsEntry) => void;
  isLoading?: boolean;
}

export default function FileColumn({
  title, entries, activeAncestorPath, selectedPath, matchPlaying,
  onOpenDir, onSelectFile, onPlayFile, isLoading,
}: FileColumnProps) {
  const sorted = sortEntries(entries);
  return (
    <div className="mle-col is-wide">
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
                isActiveAncestor={entry.path === activeAncestorPath}
                isPlaying={matchPlaying(entry)}
                onClick={onClick}
                onActivate={onActivate}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "var(--ink-4)", fontSize: 12 }}>
      {message}
    </div>
  );
}
