import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAtom, useSetAtom } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorToastAtom } from "../../../shared/model/errorToastAtom";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../../entities/scan/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { getWorkRegisterPreview, reassignIdentityConflict } from "../api";
import { deleteWork, getWork } from "../../../entities/work/api";
import { clampFilesPreviewWidth, filesPreviewWidthAtom } from "../model/previewLayoutAtoms";
import { copyPathSuccessAtom } from "../model/atoms";
import RegisterWorkDialog from "./RegisterWorkDialog";
import { Hero, WorkspaceMedia } from "./FilePreviewMedia";
import type { ScanDiagnostic, WorkRegisterPreview, WorkspacePath } from "@mimimilli/shared";
import {
  classifyFile,
  joinPath,
  summarizeKinds,
  FILE_KIND_LABEL,
  type FsEntry,
} from "../model/types";
import { apiErrorMessage } from "../../../shared/lib/apiError";

/** cwd取得の失敗種別。notFound=404（対象が存在しない）、error=5xx/通信失敗（再試行すれば回復しうる） */
export type FileLoadError = "notFound" | "error";

interface FilePreviewProps {
  /** 選択中エントリ（ファイル or dir）。loadError があるときは null */
  entry: FsEntry | null;
  /** entry が dir のときその直下エントリ（種別内訳・全wav再生に使用） */
  folderEntries: FsEntry[] | null;
  /** 物理階層の深さ（パンくず段数） */
  depth: number;
  /** 現在開いているディレクトリ（FS キャッシュ無効化用） */
  browsePath: string;
  /** ワークスペースルートの絶対パス（entry.path はroot相対のportableパスなので、絶対パスコピーに使う） */
  rootFolder: string;
  isPlayingEntry: boolean;
  isPlaybackActive: boolean;
  onPlay: (entry: FsEntry) => void;
  /** 再生中のエントリの一時停止・再開を切り替える（先頭からの再生し直しをしない） */
  onTogglePlay: () => void;
  /** 作品登録・解除後にファイル一覧を再取得する */
  onWorkRegistered?: () => void | Promise<unknown>;
  identityConflict: ScanDiagnostic | null;
  loadError: FileLoadError | null;
  onRetryLoad: () => void;
  hasAncestors: boolean;
  onGoUp: () => void;
  onGoRoot: () => void;
  onClose: () => void;
}

export default function FilePreview({
  entry,
  folderEntries,
  depth,
  browsePath,
  rootFolder,
  isPlayingEntry,
  isPlaybackActive,
  onPlay,
  onTogglePlay,
  onWorkRegistered,
  identityConflict,
  loadError,
  onRetryLoad,
  hasAncestors,
  onGoUp,
  onGoRoot,
  onClose,
}: FilePreviewProps) {
  const queryClient = useQueryClient();
  const setErrorToast = useSetAtom(errorToastAtom);
  const setCopyPathSuccess = useSetAtom(copyPathSuccessAtom);
  const [width, setWidth] = useAtom(filesPreviewWidthAtom);
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const resizeDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeDragRef.current = { startX: event.clientX, startWidth: width };
    },
    [width],
  );
  const onResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag) return;
    // プレビューは右側パネルなので、左（ポインタのマイナス方向）へ動かすほど幅が増える
    const next = clampFilesPreviewWidth(drag.startWidth + (drag.startX - event.clientX));
    anchorRef.current?.style.setProperty("--files-prv-w", `${next}px`);
  }, []);
  const onResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = resizeDragRef.current;
      resizeDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag) return;
      const raw = anchorRef.current?.style.getPropertyValue("--files-prv-w") ?? "";
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) setWidth(clampFilesPreviewWidth(parsed));
    },
    [setWidth],
  );

  const refreshFsState = useCallback(async () => {
    const paths = new Set<string>();
    if (entry) paths.add(entry.path);
    if (browsePath) paths.add(browsePath);
    await Promise.all(
      [...paths].map((path) =>
        queryClient.invalidateQueries({ queryKey: FILE_SYSTEM_QUERY_KEYS.directory(path) }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: FILE_SYSTEM_QUERY_KEYS.all() });
    await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() });
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
        setErrorToast("この場所は既に作品として登録されています");
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

  const copyAbsolutePath = useCallback(
    async (path: string) => {
      try {
        await navigator.clipboard.writeText(path);
        setCopyPathSuccess("絶対パスをコピーしました");
      } catch (cause) {
        setErrorToast(apiErrorMessage(cause, "パスのコピーに失敗しました"));
      }
    },
    [setCopyPathSuccess, setErrorToast],
  );

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
  const isSingleFileWork =
    !isDir && !!entry?.workId && (entry.workRelPath === "" || entry.workRelPath === ".");
  const canRegisterFolder = isDir && entry && !entry.workId;
  const canRegisterFile = kind === "audio" && entry && !entry.workId;

  // 単一ファイル作品は物理ファイル名がタイトルと無関係なことが多く、フォルダー名からの
  // 推測（getWorkFolderDisplay）では実際の作品タイトルを表示できない。作品を直接引く
  // （TASK-428.18 / files-A-02）。
  const singleFileWorkId = isSingleFileWork ? (entry?.workId ?? null) : null;
  const singleFileWorkQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(singleFileWorkId ?? ""),
    queryFn: () => getWork(singleFileWorkId!),
    enabled: singleFileWorkId != null,
  });
  const workTitle = singleFileWorkId ? singleFileWorkQuery.data?.title : undefined;

  // 再生中エントリを押し直すと先頭から掛け直されてしまうため（TASK-428.18 / files-A-03）、
  // ロード済みのときはトグル（一時停止・再開）にする。再生位置を変えない。
  const isLoadedEntry = kind === "audio" && isPlayingEntry;
  const playActions =
    kind === "audio" ? (
      <Button
        variant="primary"
        icon={isLoadedEntry ? (isPlaybackActive ? I.pause : I.play) : I.play}
        onClick={() => (isLoadedEntry ? onTogglePlay() : onPlay(entry!))}
      >
        {isLoadedEntry ? (isPlaybackActive ? "一時停止" : "再開") : "このファイルを再生"}
      </Button>
    ) : isDir && firstAudioFile ? (
      <Button variant="primary" icon={I.play} onClick={() => onPlay(firstAudioFile)}>
        先頭の音声を再生
      </Button>
    ) : null;

  const workActions =
    canRegisterFolder || canRegisterFile ? (
      <Button
        variant="primary"
        icon={I.add}
        disabled={registerPreviewMutation.isPending}
        onClick={() => {
          setErrorToast(null);
          if (entry) registerPreviewMutation.mutate(entry.path);
        }}
      >
        {isDir ? "このフォルダーを作品として登録" : "このファイルを作品として登録"}
      </Button>
    ) : (isWorkFolder || isSingleFileWork) && entry?.workId ? (
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
  const absolutePath = entry ? joinPath(rootFolder, entry.path.split("/").filter(Boolean)) : "";

  return (
    <div
      ref={anchorRef}
      className="mle-prv-anchor is-files"
      style={{ "--files-prv-w": `${width}px` } as CSSProperties}
    >
      <button
        type="button"
        className="mle-prv__close"
        aria-label="プレビューを閉じる"
        title="プレビューを閉じる"
        onClick={onClose}
      >
        <I.chev size={14} />
      </button>
      <div
        className="mle-prv__resize"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hr は静的な区切り線の意味しか持たない。ここはドラッグでプレビュー幅を変えるsplitter（WAI-ARIA window-splitterパターン）なのでrole="separator"を使う
        role="separator"
        aria-orientation="vertical"
        aria-label="プレビュー幅"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
      {/* ドラッグでの幅変更のみ対応。キーボード操作は未対応（TASK-428.18スコープ外） */}

      <div className="mle-prv is-files">
        {loadError ? (
          <FileLoadErrorPreview
            kind={loadError}
            path={browsePath}
            hasAncestors={hasAncestors}
            onGoUp={onGoUp}
            onGoRoot={onGoRoot}
            onRetry={onRetryLoad}
          />
        ) : (
          <>
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
                    <WorkspaceMedia
                      entry={entry}
                      isWorkFolder={isWorkFolder || isSingleFileWork}
                      workTitle={workTitle}
                    />
                  ) : (
                    <Hero
                      kind={kind!}
                      entry={entry}
                      isWorkFolder={isWorkFolder || isSingleFileWork}
                      breakdown={isDir ? breakdown : undefined}
                      workTitle={workTitle}
                    />
                  )}

                  {/* ローカル専用機能（絶対パスコピー）。TASK-428.18 決定事項 */}
                  <div className="mle-fprev__pathblock">
                    <div className="mle-fprev__pathrow">
                      <code className="mle-fprev__pathrow-text">{absolutePath}</code>
                      <IconButton
                        icon={I.copy}
                        label="絶対パスをコピー（ローカル専用）"
                        title="絶対パスをコピー（この端末でのみ有効なパスです）"
                        size="sm"
                        onClick={() => copyAbsolutePath(absolutePath)}
                      />
                    </div>
                    <p className="mle-fprev__pathblock-hint">
                      この端末のローカルパスです。他の端末やクラウドでは無効です。
                    </p>
                  </div>

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
          </>
        )}
      </div>

      {showRegisterDialog && registerPreview && entry && (
        <RegisterWorkDialog
          folderPath={entry.path}
          targetKind={isDir ? "folder" : "file"}
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
          message={
            isSingleFileWork
              ? "このファイルの作品データ（再生履歴・タグを含む）と管理ファイル（.mimimilli.json）を削除します。音声ファイル自体は削除されません。"
              : "このフォルダーの作品データ（再生履歴・タグを含む）と管理ファイル（mimimilli.json）を削除します。音声などの物理ファイルは削除されません。"
          }
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

interface FileLoadErrorPreviewProps {
  kind: FileLoadError;
  path: string;
  hasAncestors: boolean;
  onGoUp: () => void;
  onGoRoot: () => void;
  onRetry: () => void;
}

/** 404（対象なし）と5xx/通信失敗（再試行可能）を区別して表示する（TASK-428.18 / files-A-01） */
function FileLoadErrorPreview({
  kind,
  path,
  hasAncestors,
  onGoUp,
  onGoRoot,
  onRetry,
}: FileLoadErrorPreviewProps) {
  if (kind === "notFound") {
    return (
      <div className="mle-prv__body">
        <CollectionStatus
          variant="list"
          kind="empty"
          message="このフォルダーは見つかりません"
          hint="移動・削除された可能性があります。"
        />
        <p className="mle-fprev__path" style={{ textAlign: "center" }}>
          {path}
        </p>
        <div className="mle-fprev__actions" style={{ justifyContent: "center" }}>
          {hasAncestors && (
            <Button variant="ghost" onClick={onGoUp}>
              1つ上の階層へ
            </Button>
          )}
          <Button variant="ghost" onClick={onGoRoot}>
            ルートへ
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mle-prv__body">
      <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
    </div>
  );
}
