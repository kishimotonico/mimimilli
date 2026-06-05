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
  /** 選択中エントリ（ファイル or dir）。null ならプレビューなし */
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
  const isDir = kind === "dir";
  const canServe = !!entry && !!entry.workId && !!entry.workRelPath;
  const showImage = kind === "image" && canServe;

  const label = isDir ? "フォルダー · 物理" : kind ? `${FILE_KIND_LABEL[kind]} · 物理` : "プレビュー";
  const audioFiles = isDir ? (folderEntries ?? []).filter((e) => classifyFile(e) === "audio") : [];
  const breakdown = isDir && folderEntries ? summarizeKinds(folderEntries) : [];
  const isWorkFolder = isDir && !!entry?.workId;

  return (
    <div className="mle-prv is-files">
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
            {showImage ? (
              <ImageMedia workId={entry.workId!} relPath={entry.workRelPath!} name={entry.name} kind={kind!} />
            ) : (
              <Hero kind={kind!} entry={entry} isWorkFolder={isWorkFolder} />
            )}

            {breakdown.length > 0 && (
              <div className="mle-fprev__chips">
                {breakdown.map(({ kind: k, count }) => {
                  const Ic = IconSet[FILE_KIND_ICON[k]] ?? I.file;
                  return (
                    <span key={k} className="mle-fprev__chip">
                      <Ic size={12} />
                      {FILE_KIND_LABEL[k]} <b>{count}</b>
                    </span>
                  );
                })}
              </div>
            )}

            {kind === "audio" && (
              <div className="mle-fprev__actions">
                <button className="mll-fab is-primary" onClick={() => onPlay(entry)} disabled={!canServe}>
                  {isPlayingEntry ? <><I.audio size={12} /> 再生中</> : <><I.play size={12} /> このファイルを再生</>}
                </button>
              </div>
            )}
            {isDir && audioFiles.length > 0 && (
              <div className="mle-fprev__actions">
                <button className="mll-fab is-primary" onClick={() => onPlay(audioFiles[0])} disabled={!audioFiles[0].workId}>
                  <I.play size={12} /> 先頭の音声を再生
                </button>
              </div>
            )}

            <MetaGrid rows={metaRows(entry, kind!, isDir, isWorkFolder)} />

            {!isDir && !canServe && kind !== "other" && (
              <p className="mle-fprev__note">このファイルは登録作品の外にあるため、プレビュー / 再生はできません。</p>
            )}
            {!isDir && canServe && (kind === "pdf" || kind === "text" || kind === "video") && (
              <p className="mle-fprev__note">
                {kind === "video" ? "動画" : kind === "pdf" ? "PDF" : "テキスト"}の埋め込みプレビューは未対応です。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function metaRows(entry: FsEntry, kind: FileKind, isDir: boolean, isWorkFolder: boolean): [string, string][] {
  if (isDir) {
    return [
      ["項目数", `${entry.childCount} 件`],
      ["種類", isWorkFolder ? "登録作品フォルダー" : "フォルダー"],
      ["パス", entry.path],
    ];
  }
  return [
    ["種類", FILE_KIND_LABEL[kind]],
    ["サイズ", formatFileSize(entry.size)],
    ["パス", entry.path],
  ];
}

// ── 空 ────────────────────────────────────────────────────────

function EmptyPreview() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--ink-4)", minHeight: 240 }}>
      <I.folderO size={28} />
      <span style={{ fontSize: 12 }}>フォルダーまたはファイルを選択してください</span>
    </div>
  );
}

// ── コンパクトなヒーロー（巨大な空ボックスを置かない） ──────────

function Hero({ kind, entry, isWorkFolder }: { kind: FileKind; entry: FsEntry; isWorkFolder: boolean }) {
  const Ic = IconSet[FILE_KIND_ICON[kind]] ?? I.file;
  const badge = isWorkFolder ? (entry.workId!.startsWith("RJ") ? "RJ" : "作品") : null;
  return (
    <div className={`mle-fprev__hero is-${kind}`}>
      <span className="ic"><Ic size={28} /></span>
      <div className="bd">
        <div className="mle-fprev__name">
          {badge && <span className="wbadge">{badge}</span>}
          {entry.name}
        </div>
        <div className="mle-fprev__path">{entry.path}</div>
      </div>
    </div>
  );
}

// ── 画像だけ大きく表示 ────────────────────────────────────────

function ImageMedia({ workId, relPath, name, kind }: { workId: string; relPath: string; name: string; kind: FileKind }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [workId, relPath]);

  if (errored) {
    return (
      <div className={`mle-fprev__hero is-${kind}`}>
        <span className="ic"><I.image size={28} /></span>
        <div className="bd">
          <div className="mle-fprev__name">{name}</div>
          <div className="mle-fprev__path">プレビューを読み込めませんでした</div>
        </div>
      </div>
    );
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
