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
import { getWorkRegisterPreview, reassignIdentityConflict } from "../api";
import { deleteWork } from "../../../entities/work/api";
import { getWorkspaceMediaUrl } from "../../../entities/file-system/api";
import { getWorkFolderDisplay } from "../model/workFolderDisplay";
import RegisterWorkDialog from "./RegisterWorkDialog";
import Lightbox from "../../../shared/ui/Lightbox";
import type {
  MediaKind,
  ScanDiagnostic,
  WorkRegisterPreview,
  WorkspacePath,
} from "@mimimilli/shared";
import {
  classifyFile,
  summarizeKinds,
  FILE_KIND_ICON,
  FILE_KIND_LABEL,
  type FsEntry,
  type FileKind,
} from "../model/types";
import { apiErrorMessage } from "../../../shared/lib/apiError";

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
  identityConflict: ScanDiagnostic | null;
}

export default function FilePreview({
  entry,
  folderEntries,
  depth,
  browsePath,
  isPlayingEntry,
  onPlay,
  onWorkRegistered,
  identityConflict,
}: FilePreviewProps) {
  const queryClient = useQueryClient();
  const setErrorToast = useSetAtom(errorToastAtom);
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);

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
    await queryClient.invalidateQueries({ queryKey: ["scan", "diagnostics"] });
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
      setErrorToast(apiErrorMessage(cause, "作品登録の解除に失敗しました"));
    },
  });

  const reassignMutation = useMutation({
    mutationFn: (path: WorkspacePath) => reassignIdentityConflict(path),
    onSuccess: async () => {
      setShowReassignConfirm(false);
      await refreshFsState();
    },
    onError: (cause) => {
      setErrorToast(apiErrorMessage(cause, "別作品としての取り込みに失敗しました"));
    },
  });

  const registerPreviewMutation = useMutation({
    mutationFn: (path: WorkspacePath) => getWorkRegisterPreview(path),
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
      setErrorToast(apiErrorMessage(cause, "登録情報の取得に失敗しました"));
    },
  });

  const kind = entry ? classifyFile(entry) : null;
  const isDir = kind === "dir";
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
  const conflictingPaths = identityConflict?.paths.filter((path) => path !== entry?.path) ?? [];

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
            {!isDir && entry.preview && entry.mediaKind ? (
              <WorkspaceMedia entry={entry} />
            ) : (
              <Hero
                kind={kind!}
                entry={entry}
                isWorkFolder={isWorkFolder}
                breakdown={isDir ? breakdown : undefined}
              />
            )}

            {hasActions && (
              <div className="mle-fprev__actions">
                {playActions}
                {workActions}
              </div>
            )}
            {identityConflict && entry?.isDir && (
              <section className="mle-identity-conflict" aria-label="ID重複">
                <span className="mle-identity-conflict-badge">ID重複</span>
                <p>同じWork IDを持つフォルダーがあります。</p>
                <div className="mle-identity-conflict__paths">
                  {conflictingPaths.map((path) => (
                    <code key={path}>{path}</code>
                  ))}
                </div>
                <Button
                  variant="primary"
                  disabled={reassignMutation.isPending}
                  onClick={() => setShowReassignConfirm(true)}
                >
                  別作品として取り込む
                </Button>
              </section>
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

      {showReassignConfirm && entry && (
        <ConfirmDialog
          title="別作品として取り込む"
          message={`「${entry.path}」のWork IDを新しくして、別作品として取り込みます。再生履歴やタグなどのユーザー状態は引き継ぎません。`}
          confirmLabel="取り込む"
          onConfirm={() => reassignMutation.mutate(entry.path)}
          onCancel={() => setShowReassignConfirm(false)}
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

function WorkspaceMedia({ entry }: { entry: FsEntry }) {
  const kind = entry.mediaKind!;
  const preview = entry.preview!;
  const src = getWorkspaceMediaUrl(entry.path);

  if (preview.kind === "unavailable") {
    return <UnavailableMedia entry={entry} kind={kind} />;
  }

  switch (kind) {
    case "audio":
      return <Hero kind="audio" entry={entry} isWorkFolder={false} />;
    case "image":
      return <ImageMedia entry={entry} src={src} />;
    case "pdf":
      return <PdfMedia entry={entry} src={src} />;
    case "text":
      return <TextMedia entry={entry} src={src} truncated={preview.kind === "truncated"} />;
    case "video":
      return <VideoMedia entry={entry} src={src} />;
    default:
      return <UnavailableMedia entry={entry} kind={kind} />;
  }
}

function MediaCaption({ entry }: { entry: FsEntry }) {
  return (
    <div className="mle-fprev__caption">
      <div className="mle-fprev__name">{entry.name}</div>
      <div className="mle-fprev__path">{entry.path}</div>
      <div className="mle-fprev__meta">{formatFileSize(entry.size)}</div>
    </div>
  );
}

function ImageMedia({ entry, src }: { entry: FsEntry; src: string }) {
  const [errored, setErrored] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  useEffect(() => setErrored(false), [src]);

  if (errored) {
    return <MediaError entry={entry} kind="image" />;
  }
  return (
    <>
      <div className="mle-fprev__media">
        <img
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role -- imgをbuttonで包むとサイズ算出が崩れる（縮小フィットのみのimgをshrink-to-fitコンテナに置くと0x0になる既知の挙動）ため、img自体をクリック領域にする
          role="button"
          className="mle-fprev__img cursor-zoom-in"
          src={src}
          alt={entry.name}
          tabIndex={0}
          aria-label="画像を拡大表示"
          onClick={() => setIsLightboxOpen(true)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setIsLightboxOpen(true);
          }}
          onError={() => setErrored(true)}
        />
      </div>
      <MediaCaption entry={entry} />
      {isLightboxOpen && (
        <Lightbox src={src} alt={entry.name} onClose={() => setIsLightboxOpen(false)} />
      )}
    </>
  );
}

function PdfMedia({ entry, src }: { entry: FsEntry; src: string }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [src]);
  if (errored) return <MediaError entry={entry} kind="pdf" />;
  return (
    <>
      <div className="mle-fprev__media is-document">
        <object
          className="mle-fprev__document"
          data={src}
          type="application/pdf"
          aria-label={`${entry.name}のPDFプレビュー`}
          onError={() => setErrored(true)}
        >
          <span>PDFを表示できませんでした。</span>
        </object>
      </div>
      <MediaCaption entry={entry} />
    </>
  );
}

function VideoMedia({ entry, src }: { entry: FsEntry; src: string }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [src]);
  if (errored) return <MediaError entry={entry} kind="video" />;
  return (
    <>
      <div className="mle-fprev__media is-video">
        <video className="mle-fprev__video" controls src={src} onError={() => setErrored(true)}>
          このブラウザは動画再生に対応していません。
        </video>
      </div>
      <MediaCaption entry={entry} />
    </>
  );
}

function TextMedia({ entry, src, truncated }: { entry: FsEntry; src: string; truncated: boolean }) {
  const [state, setState] = useState<{ text: string; error: boolean }>({ text: "", error: false });

  useEffect(() => {
    const controller = new AbortController();
    setState({ text: "", error: false });
    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("text preview failed");
        return response.text();
      })
      .then((text) => setState({ text, error: false }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ text: "", error: true });
      });
    return () => controller.abort();
  }, [src]);

  if (state.error) return <MediaError entry={entry} kind="text" />;
  return (
    <>
      <div className="mle-fprev__media is-text">
        <pre className="mle-fprev__text">{state.text}</pre>
      </div>
      {truncated && <p className="mle-fprev__note">サイズ上限のため先頭のみ表示</p>}
      <MediaCaption entry={entry} />
    </>
  );
}

function UnavailableMedia({ entry, kind }: { entry: FsEntry; kind: MediaKind }) {
  const fileKind = kind === "other" ? "other" : kind;
  const Icon = I[FILE_KIND_ICON[fileKind]];
  const extension = extensionOf(entry.name);
  return (
    <div className={`mle-fprev__hero is-${fileKind}`}>
      <span className="ic">
        <Icon size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">
          {FILE_KIND_LABEL[fileKind]}
          {extension ? `（.${extension}）` : ""}のプレビューは利用できません
        </div>
      </div>
    </div>
  );
}

function MediaError({
  entry,
  kind,
}: {
  entry: FsEntry;
  kind: Exclude<MediaKind, "audio" | "other">;
}) {
  const Icon = I[FILE_KIND_ICON[kind]];
  return (
    <div className={`mle-fprev__hero is-${kind}`} role="alert">
      <span className="ic">
        <Icon size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">プレビューを読み込めませんでした</div>
      </div>
    </div>
  );
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : null;
}
