import { useState, useEffect } from "react";
import React from "react";
import { I } from "../../../shared/ui/Icon";
import { formatFileSize } from "../../../shared/lib/format";
import { getFileUrl } from "../api";
import {
  classifyFile,
  summarizeKinds,
  FILE_KIND_ICON,
  FILE_KIND_LABEL,
  type FsEntry,
  type FileKind,
} from "../model/types";

const IconSet = I as Record<string, (p: { size?: number }) => React.ReactElement>;

interface FilePreviewProps {
  /** 選択中エントリ（ファイル or dir）。null ならカレント dir そのもの */
  entry: FsEntry | null;
  /** entry が dir のときその直下エントリ（種別内訳・全wav再生に使用） */
  folderEntries: FsEntry[] | null;
  /** 物理階層の深さ（パンくず段数） */
  depth: number;
  isPlayingEntry: boolean;
  onPlay: (entry: FsEntry) => void;
}

export default function FilePreview({ entry, folderEntries, depth, isPlayingEntry, onPlay }: FilePreviewProps) {
  const kind = entry ? classifyFile(entry) : null;
  const isDir = !entry || kind === "dir";

  return (
    <div className="mle-prv is-files">
      <div className="mle-prv__hd">
        <span className="label">{isDir ? "フォルダー · 物理" : `${FILE_KIND_LABEL[kind!]} · 物理`}</span>
        {entry && !isDir && <span className="pill" style={{ marginLeft: "auto" }}>{kind?.toUpperCase()}</span>}
        {isDir && <span className="pill" style={{ marginLeft: "auto" }}>深さ {depth} 階層</span>}
      </div>
      <div className="mle-prv__body">
        {!entry ? (
          <EmptyPreview />
        ) : isDir ? (
          <FolderPreview entry={entry} folderEntries={folderEntries} onPlay={onPlay} />
        ) : (
          <FileBody entry={entry} kind={kind!} isPlayingEntry={isPlayingEntry} onPlay={onPlay} />
        )}
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--ink-4)", minHeight: 240 }}>
      <I.folderO size={28} />
      <span style={{ fontSize: 12 }}>フォルダーまたはファイルを選択してください</span>
    </div>
  );
}

// ── フォルダー ────────────────────────────────────────────────

function FolderPreview({ entry, folderEntries, onPlay }: { entry: FsEntry; folderEntries: FsEntry[] | null; onPlay: (e: FsEntry) => void }) {
  const breakdown = folderEntries ? summarizeKinds(folderEntries) : [];
  const audioFiles = (folderEntries ?? []).filter((e) => classifyFile(e) === "audio");
  const isWork = !!entry.workId;

  return (
    <div className="mle-fprev">
      <div className="mle-fprev__media is-icon">
        <I.folder size={64} />
      </div>
      <div>
        <div className="mle-fprev__name">
          {isWork && <span className="wbadge">{entry.workId!.startsWith("RJ") ? "RJ" : "作品"}</span>}
          {entry.name}
        </div>
        <div className="mle-fprev__path">{entry.path}</div>
      </div>

      {breakdown.length > 0 && (
        <div className="mle-fprev__chips">
          {breakdown.map(({ kind, count }) => {
            const Ic = IconSet[FILE_KIND_ICON[kind]] ?? I.file;
            return (
              <span key={kind} className="mle-fprev__chip">
                <Ic size={12} />
                {FILE_KIND_LABEL[kind]} <b>{count}</b>
              </span>
            );
          })}
        </div>
      )}

      {audioFiles.length > 0 && (
        <div className="mle-fprev__actions">
          <button className="mll-fab is-primary" onClick={() => onPlay(audioFiles[0])} disabled={!audioFiles[0].workId}>
            <I.play size={12} /> 先頭の音声を再生
          </button>
        </div>
      )}

      <MetaGrid
        rows={[
          ["項目数", `${entry.childCount} 件`],
          ["種類", isWork ? "登録作品フォルダー" : "フォルダー"],
          ["パス", entry.path],
        ]}
      />
    </div>
  );
}

// ── ファイル ──────────────────────────────────────────────────

function FileBody({ entry, kind, isPlayingEntry, onPlay }: { entry: FsEntry; kind: FileKind; isPlayingEntry: boolean; onPlay: (e: FsEntry) => void }) {
  const Ic = IconSet[FILE_KIND_ICON[kind]] ?? I.file;
  const canServe = !!entry.workId && !!entry.workRelPath;

  return (
    <div className="mle-fprev">
      {kind === "image" && canServe ? (
        <ImagePreview workId={entry.workId!} relPath={entry.workRelPath!} name={entry.name} fallbackIcon={<Ic size={56} />} />
      ) : (
        <div className={`mle-fprev__media is-icon is-${kind}`}>
          <Ic size={56} />
        </div>
      )}

      <div>
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">{entry.path}</div>
      </div>

      {kind === "audio" && (
        <div className="mle-fprev__actions">
          <button className="mll-fab is-primary" onClick={() => onPlay(entry)} disabled={!canServe}>
            {isPlayingEntry ? <><I.audio size={12} /> 再生中</> : <><I.play size={12} /> このファイルを再生</>}
          </button>
        </div>
      )}

      <MetaGrid
        rows={[
          ["種類", FILE_KIND_LABEL[kind]],
          ["サイズ", formatFileSize(entry.size)],
          ["パス", entry.path],
        ]}
      />

      {!canServe && kind !== "other" && (
        <p className="mle-fprev__note">
          このファイルは登録作品の外にあるため、プレビュー / 再生はできません。
        </p>
      )}
      {canServe && (kind === "pdf" || kind === "text" || kind === "video") && (
        <p className="mle-fprev__note">
          {kind === "video" ? "動画" : kind === "pdf" ? "PDF" : "テキスト"}の埋め込みプレビューは未対応です。
        </p>
      )}
    </div>
  );
}

function ImagePreview({ workId, relPath, name, fallbackIcon }: { workId: string; relPath: string; name: string; fallbackIcon: React.ReactNode }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [workId, relPath]);

  if (errored) {
    return <div className="mle-fprev__media is-icon is-image">{fallbackIcon}</div>;
  }
  return (
    <div className="mle-fprev__media">
      <img className="mle-fprev__img" src={getFileUrl(workId, relPath)} alt={name} onError={() => setErrored(true)} />
    </div>
  );
}

// ── メタ情報グリッド ──────────────────────────────────────────

function MetaGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mle-fprev__grid">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="mle-fprev__k">{k}</span>
          <span className="mle-fprev__v">{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
