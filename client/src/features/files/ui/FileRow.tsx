import React from "react";
import { I } from "../../../shared/ui/Icon";
import { formatFileSize } from "../../../shared/lib/format";
import { classifyFile, FILE_KIND_ICON, FILE_KIND_ROW_CLASS, type FsEntry } from "../model/types";
import { getWorkFolderDisplay } from "../model/workFolderDisplay";

interface FileRowProps {
  entry: FsEntry;
  /** 選択中エントリ本体（濃いハイライト） */
  isFocused: boolean;
  /** このファイルが今再生中 */
  isPlaying: boolean;
  isPlaybackActive?: boolean;
  onClick: () => void;
  onActivate: () => void;
}

const IconSet = I as Record<string, (p: { size?: number }) => React.ReactElement>;

export default function FileRow({ entry, isFocused, isPlaying, isPlaybackActive, onClick, onActivate }: FileRowProps) {
  const kind = classifyFile(entry);
  const Ic = IconSet[FILE_KIND_ICON[kind]] ?? I.file;
  const isWorkFolder = entry.isDir && !!entry.workId;
  const display = getWorkFolderDisplay(entry.name, isWorkFolder ? entry.workId : null);

  const cls = [
    "mle-row",
    FILE_KIND_ROW_CLASS[kind],
    isWorkFolder ? "is-folder-work" : "",
    isFocused ? "is-on is-focused" : "",
    isPlaying ? "is-now" : "",
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={cls} onClick={onClick} onDoubleClick={onActivate} title={entry.name}>
      <span className="ficon">
        {isPlaying ? (
          <span
            className={`barwave ${isPlaybackActive ? "" : "is-paused"}`}
            aria-label={isPlaybackActive ? "再生中" : "一時停止中"}
            title={isPlaybackActive ? "再生中" : "一時停止中"}
          >
            <span /><span /><span />
          </span>
        ) : <Ic size={15} />}
      </span>
      <span className="name">
        {display.badge && <span className="wbadge">{display.badge}</span>}
        {display.name}
      </span>
      <span className="meta">{entry.isDir ? `${entry.childCount}` : formatFileSize(entry.size)}</span>
      <span className="chev">{entry.isDir ? <I.chev size={11} /> : null}</span>
    </button>
  );
}
