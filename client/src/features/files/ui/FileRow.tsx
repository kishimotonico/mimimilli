import { I } from "../../../shared/ui/Icon";
import { formatFileSize } from "../../../shared/lib/format";
import { classifyFile, FILE_KIND_ICON, FILE_KIND_ROW_CLASS, type FsEntry } from "../model/types";
import { getWorkFolderDisplay } from "../model/workFolderDisplay";
import type { ScanDiagnostic } from "@mimimilli/shared";

interface FileRowProps {
  entry: FsEntry;
  identityConflict: ScanDiagnostic | null;
  /** 選択中エントリ本体（濃いハイライト） */
  isFocused: boolean;
  /** このファイルが今再生中 */
  isPlaying: boolean;
  isPlaybackActive?: boolean;
  onClick: () => void;
  onActivate: () => void;
}

export default function FileRow({
  entry,
  identityConflict,
  isFocused,
  isPlaying,
  isPlaybackActive,
  onClick,
  onActivate,
}: FileRowProps) {
  const kind = classifyFile(entry);
  const Ic = I[FILE_KIND_ICON[kind]];
  // フォルダーは workId があれば登録済み、ファイル単体は workRelPath が自分自身を指す
  // （"" または "."）ときだけ登録済み（TASK-428.18）。
  const isRegisteredWork =
    !!entry.workId && (entry.isDir || entry.workRelPath === "" || entry.workRelPath === ".");
  const display = getWorkFolderDisplay(entry.name, isRegisteredWork ? entry.workId : null);

  const cls = [
    "mle-row",
    FILE_KIND_ROW_CLASS[kind],
    isRegisteredWork ? "is-work" : "",
    isFocused ? "is-on is-focused" : "",
    isPlaying ? "is-now" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      onDoubleClick={onActivate}
      title={entry.name}
    >
      <span className="ficon">
        {isPlaying ? (
          <span
            className={`barwave ${isPlaybackActive ? "" : "is-paused"}`}
            aria-label={isPlaybackActive ? "再生中" : "一時停止中"}
            title={isPlaybackActive ? "再生中" : "一時停止中"}
          >
            <span />
            <span />
            <span />
          </span>
        ) : (
          <Ic size={15} />
        )}
      </span>
      <span className="name">
        {display.badge && <span className="wbadge">{display.badge}</span>}
        {display.name}
        {identityConflict && <span className="mle-identity-conflict-badge">ID重複</span>}
      </span>
      <span className="meta">
        {entry.isDir ? `${entry.childCount}` : formatFileSize(entry.size)}
      </span>
      <span className="chev">{entry.isDir ? <I.chev size={11} /> : null}</span>
    </button>
  );
}
