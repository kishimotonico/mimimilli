import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { formatFileSize } from "../../../shared/lib/format";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { createWork, deleteWork, getWorkRegisterPreview } from "../api";
import { getFileUrl } from "../api";
import { getWorkFolderDisplay } from "../model/workFolderDisplay";
import RegisterWorkDialog from "./RegisterWorkDialog";
import type { WorkRegisterPreview } from "@mimimilli/shared";
import {
  classifyFile,
  summarizeKinds,
  FILE_KIND_ICON,
  FILE_KIND_LABEL,
  type FsEntry,
  type FileKind,
} from "../model/types";

interface FilePreviewProps {
  /** 選択中エントリ（ファイル or dir）。null ならプレビューなし */
  entry: FsEntry | null;
  /** entry が dir のときその直下エントリ（種別内訳・全wav再生に使用） */
  folderEntries: FsEntry[] | null;
  /** 物理階層の深さ（パンくず段数） */
  depth: number;
  isPlayingEntry: boolean;
  onPlay: (entry: FsEntry) => void;
  /** 作品登録完了後にファイル一覧を再取得する */
  onWorkRegistered?: () => void;
}

export default function FilePreview({
  entry,
  folderEntries,
  depth,
  isPlayingEntry,
  onPlay,
  onWorkRegistered,
}: FilePreviewProps) {
  const queryClient = useQueryClient();
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [quickMergeConfirm, setQuickMergeConfirm] = useState<WorkRegisterPreview | null>(null);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [unregisterBusy, setUnregisterBusy] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const kind = entry ? classifyFile(entry) : null;
  const isDir = kind === "dir";
  const canServeWorkFile = !!entry && !!entry.workId && !!entry.workRelPath;
  const showImage = kind === "image" && canServeWorkFile;

  const label = isDir
    ? "フォルダー · 物理"
    : kind
      ? `${FILE_KIND_LABEL[kind]} · 物理`
      : "プレビュー";
  const audioFiles = isDir ? (folderEntries ?? []).filter((e) => classifyFile(e) === "audio") : [];
  const firstAudioFile = audioFiles[0];
  const breakdown = isDir && folderEntries ? summarizeKinds(folderEntries) : [];
  const isWorkFolder = isDir && !!entry?.workId;
  const canRegisterFolder = isDir && entry && !entry.workId;

  const invalidateAfterRegister = useCallback(async () => {
    if (entry) {
      await queryClient.invalidateQueries({
        queryKey: FILE_SYSTEM_QUERY_KEYS.directory(entry.path),
      });
    }
    await queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
    onWorkRegistered?.();
  }, [entry, onWorkRegistered, queryClient]);

  const handleUnregister = async () => {
    if (!entry?.workId) return;
    setUnregisterBusy(true);
    setRegisterError(null);
    try {
      await deleteWork(entry.workId);
      setShowUnregisterConfirm(false);
      await invalidateAfterRegister();
    } catch (cause) {
      setRegisterError(cause instanceof Error ? cause.message : "作品登録の解除に失敗しました");
    } finally {
      setUnregisterBusy(false);
    }
  };

  const openRegisterDialog = async () => {
    if (!entry) return;
    setRegisterError(null);
    setRegisterBusy(true);
    try {
      const preview = await getWorkRegisterPreview(entry.path);
      if (preview.alreadyRegistered) {
        setRegisterError("このフォルダーは既に登録済みです");
        return;
      }
      setRegisterPreview(preview);
      setShowRegisterDialog(true);
    } catch (cause) {
      setRegisterError(cause instanceof Error ? cause.message : "登録情報の取得に失敗しました");
    } finally {
      setRegisterBusy(false);
    }
  };

  const quickRegister = async (preview: WorkRegisterPreview) => {
    if (!entry) return;
    setRegisterBusy(true);
    setRegisterError(null);
    try {
      await createWork({
        path: entry.path,
        title: preview.suggestedTitle,
        mergeDescendantWorks: preview.descendantWorkCount > 0,
      });
      setQuickMergeConfirm(null);
      await invalidateAfterRegister();
    } catch (cause) {
      setRegisterError(cause instanceof Error ? cause.message : "作品の登録に失敗しました");
    } finally {
      setRegisterBusy(false);
    }
  };

  const handleQuickRegister = async () => {
    if (!entry) return;
    setRegisterError(null);
    setRegisterBusy(true);
    try {
      const preview = await getWorkRegisterPreview(entry.path);
      if (preview.alreadyRegistered) {
        setRegisterError("このフォルダーは既に登録済みです");
        return;
      }
      if (preview.descendantWorkCount > 0) {
        setQuickMergeConfirm(preview);
        return;
      }
      await quickRegister(preview);
    } catch (cause) {
      setRegisterError(cause instanceof Error ? cause.message : "登録情報の取得に失敗しました");
    } finally {
      setRegisterBusy(false);
    }
  };

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
              <ImageMedia
                workId={entry.workId!}
                relPath={entry.workRelPath!}
                name={entry.name}
                kind={kind!}
              />
            ) : (
              <Hero kind={kind!} entry={entry} isWorkFolder={isWorkFolder} />
            )}

            {breakdown.length > 0 && (
              <div className="mle-fprev__chips">
                {breakdown.map(({ kind: k, count }) => {
                  const Ic = I[FILE_KIND_ICON[k]];
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
                <Button
                  variant="primary"
                  icon={isPlayingEntry ? I.audio : I.play}
                  onClick={() => onPlay(entry)}
                >
                  {isPlayingEntry ? "再生中" : "このファイルを再生"}
                </Button>
              </div>
            )}
            {isDir && firstAudioFile && (
              <div className="mle-fprev__actions">
                <Button variant="primary" icon={I.play} onClick={() => onPlay(firstAudioFile)}>
                  先頭の音声を再生
                </Button>
              </div>
            )}
            {canRegisterFolder && (
              <div className="mle-fprev__actions">
                <Button
                  variant="primary"
                  icon={I.add}
                  disabled={registerBusy}
                  onClick={openRegisterDialog}
                >
                  このフォルダを作品として登録
                </Button>
                <Button variant="ghost" disabled={registerBusy} onClick={handleQuickRegister}>
                  そのまま登録
                </Button>
              </div>
            )}
            {isWorkFolder && entry.workId && (
              <div className="mle-fprev__actions">
                <Button
                  variant="ghost"
                  disabled={unregisterBusy}
                  onClick={() => {
                    setRegisterError(null);
                    setShowUnregisterConfirm(true);
                  }}
                >
                  作品登録を解除
                </Button>
              </div>
            )}
            {registerError && (
              <p className="m-0 text-[11px] text-[var(--r-coral)]">{registerError}</p>
            )}

            <MetaGrid rows={metaRows(entry, kind!, isDir, isWorkFolder)} />

            {!isDir &&
              canServeWorkFile &&
              (kind === "pdf" || kind === "text" || kind === "video") && (
                <p className="mle-fprev__note">
                  {kind === "video" ? "動画" : kind === "pdf" ? "PDF" : "テキスト"}
                  の埋め込みプレビューは未対応です。
                </p>
              )}
          </div>
        )}
      </div>

      {showRegisterDialog && registerPreview && entry && (
        <RegisterWorkDialog
          folderPath={entry.path}
          preview={registerPreview}
          onRegistered={invalidateAfterRegister}
          onClose={() => {
            setShowRegisterDialog(false);
            setRegisterPreview(null);
          }}
        />
      )}

      {quickMergeConfirm && (
        <ConfirmDialog
          title="登録済み作品の統合"
          message={`登録済み作品 ${quickMergeConfirm.descendantWorkCount} 件を解除して統合します。子作品の履歴・タグは引き継がれません。`}
          confirmLabel="統合して登録"
          onConfirm={() => quickRegister(quickMergeConfirm)}
          onCancel={() => setQuickMergeConfirm(null)}
        />
      )}

      {showUnregisterConfirm && (
        <ConfirmDialog
          title="作品登録を解除"
          message="このフォルダーの作品データ（再生履歴・タグを含む）と mimimilli.json を削除します。音声ファイルなどの物理ファイルは削除されません。"
          confirmLabel="解除する"
          onConfirm={() => void handleUnregister()}
          onCancel={() => setShowUnregisterConfirm(false)}
        />
      )}
    </div>
  );
}

function metaRows(
  entry: FsEntry,
  kind: FileKind,
  isDir: boolean,
  isWorkFolder: boolean,
): [string, string][] {
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
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        color: "var(--ink-4)",
        minHeight: 240,
      }}
    >
      <I.folderO size={28} />
      <span style={{ fontSize: 12 }}>フォルダーまたはファイルを選択してください</span>
    </div>
  );
}

// ── コンパクトなヒーロー（巨大な空ボックスを置かない） ──────────

function Hero({
  kind,
  entry,
  isWorkFolder,
}: {
  kind: FileKind;
  entry: FsEntry;
  isWorkFolder: boolean;
}) {
  const Ic = I[FILE_KIND_ICON[kind]];
  const display = getWorkFolderDisplay(entry.name, isWorkFolder ? entry.workId : null);
  return (
    <div className={`mle-fprev__hero is-${kind}`}>
      <span className="ic">
        <Ic size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">
          {display.badge && <span className="wbadge">{display.badge}</span>}
          {display.name}
        </div>
        <div className="mle-fprev__path">{entry.path}</div>
      </div>
    </div>
  );
}

// ── 画像だけ大きく表示 ────────────────────────────────────────

function ImageMedia({
  workId,
  relPath,
  name,
  kind,
}: {
  workId: string;
  relPath: string;
  name: string;
  kind: FileKind;
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [workId, relPath]);

  if (errored) {
    return (
      <div className={`mle-fprev__hero is-${kind}`}>
        <span className="ic">
          <I.image size={28} />
        </span>
        <div className="bd">
          <div className="mle-fprev__name">{name}</div>
          <div className="mle-fprev__path">プレビューを読み込めませんでした</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mle-fprev__media">
      <img
        className="mle-fprev__img"
        src={getFileUrl(workId, relPath)}
        alt={name}
        onError={() => setErrored(true)}
      />
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
