import { useCallback, useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorToastAtom } from "../../../shared/model/errorToastAtom";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { formatFileSize } from "../../../shared/lib/format";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { deleteWork, getWorkRegisterPreview } from "../api";
import { getFileUrl } from "../../../entities/work/api";
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
import { mutationErrorMessage } from "../../../shared/lib/mutationError";

interface FilePreviewProps {
  /** 選択中エントリ（ファイル or dir）。null ならプレビューなし */
  entry: FsEntry | null;
  /** entry が dir のときその直下エントリ（種別内訳・全wav再生に使用） */
  folderEntries: FsEntry[] | null;
  /** 物理階層の深さ（パンくず段数） */
  depth: number;
  /** 現在開いているディレクトリ（FS キャッシュ無効化用） */
  browsePath: string;
  isPlayingEntry: boolean;
  onPlay: (entry: FsEntry) => void;
  /** 作品登録・解除後にファイル一覧を再取得する */
  onWorkRegistered?: () => void | Promise<unknown>;
}

export default function FilePreview({
  entry,
  folderEntries,
  depth,
  browsePath,
  isPlayingEntry,
  onPlay,
  onWorkRegistered,
}: FilePreviewProps) {
  const queryClient = useQueryClient();
  const setErrorToast = useSetAtom(errorToastAtom);
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);

  const refreshFsState = useCallback(async () => {
    const paths = new Set<string>();
    if (entry) paths.add(entry.path);
    if (browsePath) paths.add(browsePath);
    await Promise.all(
      [...paths].map((path) =>
        queryClient.invalidateQueries({ queryKey: FILE_SYSTEM_QUERY_KEYS.directory(path) }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["fs"] });
    await queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
    await onWorkRegistered?.();
  }, [browsePath, entry, onWorkRegistered, queryClient]);

  const unregisterMutation = useMutation({
    mutationFn: (workId: string) => deleteWork(workId),
    onSuccess: async () => {
      setShowUnregisterConfirm(false);
      await refreshFsState();
    },
    onError: (cause) => {
      setErrorToast(mutationErrorMessage(cause, "作品登録の解除に失敗しました"));
    },
  });

  const registerPreviewMutation = useMutation({
    mutationFn: (path: string) => getWorkRegisterPreview(path),
    onSuccess: async (preview) => {
      if (preview.alreadyRegistered) {
        setErrorToast("このフォルダーは既に作品として登録されています");
        await refreshFsState();
        return;
      }
      setRegisterPreview(preview);
      setShowRegisterDialog(true);
    },
    onError: (cause) => {
      setErrorToast(mutationErrorMessage(cause, "登録情報の取得に失敗しました"));
    },
  });

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

  const playActions =
    kind === "audio" ? (
      <Button
        variant="primary"
        icon={isPlayingEntry ? I.audio : I.play}
        onClick={() => onPlay(entry!)}
      >
        {isPlayingEntry ? "再生中" : "このファイルを再生"}
      </Button>
    ) : isDir && firstAudioFile ? (
      <Button variant="primary" icon={I.play} onClick={() => onPlay(firstAudioFile)}>
        先頭の音声を再生
      </Button>
    ) : null;

  const workActions = canRegisterFolder ? (
    <Button
      variant="primary"
      icon={I.add}
      disabled={registerPreviewMutation.isPending}
      onClick={() => {
        setErrorToast(null);
        if (entry) registerPreviewMutation.mutate(entry.path);
      }}
    >
      このフォルダーを作品として登録
    </Button>
  ) : isWorkFolder && entry?.workId ? (
    <Button
      variant="ghost"
      disabled={unregisterMutation.isPending}
      onClick={() => {
        setErrorToast(null);
        setShowUnregisterConfirm(true);
      }}
    >
      作品登録を解除
    </Button>
  ) : null;

  const hasActions = playActions != null || workActions != null;

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
                entry={entry}
                kind={kind!}
              />
            ) : (
              <Hero
                kind={kind!}
                entry={entry}
                isWorkFolder={isWorkFolder}
                breakdown={isDir ? breakdown : undefined}
              />
            )}

            {!isDir &&
              canServeWorkFile &&
              (kind === "pdf" || kind === "text" || kind === "video") && (
                <p className="mle-fprev__note">
                  {kind === "video" ? "動画" : kind === "pdf" ? "PDF" : "テキスト"}
                  の埋め込みプレビューは未対応です。
                </p>
              )}

            {hasActions && (
              <div className="mle-fprev__actions">
                {playActions}
                {workActions}
              </div>
            )}
          </div>
        )}
      </div>

      {showRegisterDialog && registerPreview && entry && (
        <RegisterWorkDialog
          folderPath={entry.path}
          preview={registerPreview}
          onRegistered={refreshFsState}
          onClose={() => {
            setShowRegisterDialog(false);
            setRegisterPreview(null);
          }}
        />
      )}

      {showUnregisterConfirm && (
        <ConfirmDialog
          title="作品登録を解除"
          message="このフォルダーの作品データ（再生履歴・タグを含む）と管理ファイル（mimimilli.json）を削除します。音声などの物理ファイルは削除されません。"
          confirmLabel="解除する"
          onConfirm={() => {
            if (entry?.workId) unregisterMutation.mutate(entry.workId);
          }}
          onCancel={() => setShowUnregisterConfirm(false)}
        />
      )}
    </div>
  );
}

function formatBreakdownLine(breakdown: { kind: FileKind; count: number }[]): string {
  return breakdown.map(({ kind: k, count }) => `${FILE_KIND_LABEL[k]} ${count}`).join(" ・ ");
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
  breakdown,
}: {
  kind: FileKind;
  entry: FsEntry;
  isWorkFolder: boolean;
  breakdown?: { kind: FileKind; count: number }[];
}) {
  const Ic = I[FILE_KIND_ICON[kind]];
  const display = getWorkFolderDisplay(entry.name, isWorkFolder ? entry.workId : null);
  const metaLine =
    breakdown && breakdown.length > 0
      ? formatBreakdownLine(breakdown)
      : kind !== "dir"
        ? formatFileSize(entry.size)
        : null;
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
        {metaLine && <div className="mle-fprev__meta">{metaLine}</div>}
      </div>
    </div>
  );
}

// ── 画像だけ大きく表示 ────────────────────────────────────────

function ImageMedia({
  workId,
  relPath,
  entry,
  kind,
}: {
  workId: string;
  relPath: string;
  entry: FsEntry;
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
          <div className="mle-fprev__name">{entry.name}</div>
          <div className="mle-fprev__path">プレビューを読み込めませんでした</div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="mle-fprev__media">
        <img
          className="mle-fprev__img"
          src={getFileUrl(workId, relPath)}
          alt={entry.name}
          onError={() => setErrored(true)}
        />
      </div>
      <div className="mle-fprev__caption">
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">{entry.path}</div>
        <div className="mle-fprev__meta">{formatFileSize(entry.size)}</div>
      </div>
    </>
  );
}
