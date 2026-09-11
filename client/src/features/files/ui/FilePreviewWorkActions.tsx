import { useCallback, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../../entities/scan/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { deleteWork } from "../../../entities/work/api";
import { getWorkRegisterPreview, reassignIdentityConflict } from "../api";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import RegisterWorkDialog from "./RegisterWorkDialog";
import type { ScanDiagnostic, WorkRegisterPreview, WorkspacePath } from "@mimimilli/shared";
import type { FileKind, FsEntry } from "../model/types";

interface FilePreviewWorkActionsProps {
  entry: FsEntry;
  isDir: boolean;
  kind: FileKind;
  browsePath: string;
  isWorkFolder: boolean;
  isSingleFileWork: boolean;
  identityConflict: ScanDiagnostic | null;
  /** 再生ボタン等、登録ワークフロー以外のアクション。存在すれば登録ボタンと同じ行に並ぶ */
  playActions: ReactNode;
  onWorkRegistered?: () => void | Promise<unknown>;
}

/** 作品登録ワークフロー（登録・解除・ID重複の取り込み）を一括で扱う。mutation・確認/登録
 *  ダイアログ・アクション行・ID重複セクションの描画までをここに閉じる（メディア
 *  描画（FilePreviewMedia.tsx）とはここで境界を分ける）。 */
export default function FilePreviewWorkActions({
  entry,
  isDir,
  kind,
  browsePath,
  isWorkFolder,
  isSingleFileWork,
  identityConflict,
  playActions,
  onWorkRegistered,
}: FilePreviewWorkActionsProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);

  const refreshFsState = useCallback(async () => {
    const paths = new Set<string>([entry.path]);
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
  }, [browsePath, entry.path, onWorkRegistered, queryClient]);

  const unregisterMutation = useMutation({
    mutationFn: (workId: string) => deleteWork(workId),
    onSuccess: async () => {
      setShowUnregisterConfirm(false);
      await refreshFsState();
    },
    onError: (cause) => {
      toast.error(apiErrorMessage(cause, "作品登録の解除に失敗しました"));
    },
  });

  const reassignMutation = useMutation({
    mutationFn: (path: WorkspacePath) => reassignIdentityConflict(path),
    onSuccess: async () => {
      setShowReassignConfirm(false);
      await refreshFsState();
    },
    onError: (cause) => {
      toast.error(apiErrorMessage(cause, "別作品としての取り込みに失敗しました"));
    },
  });

  const registerPreviewMutation = useMutation({
    mutationFn: (path: WorkspacePath) => getWorkRegisterPreview(path),
    onSuccess: async (preview) => {
      if (preview.alreadyRegistered) {
        toast.error("この場所は既に作品として登録されています");
        await refreshFsState();
        return;
      }
      setRegisterPreview(preview);
      setShowRegisterDialog(true);
    },
    onError: (cause) => {
      toast.error(apiErrorMessage(cause, "登録情報の取得に失敗しました"));
    },
  });

  const canRegisterFolder = isDir && !entry.workId;
  const canRegisterFile = kind === "audio" && !entry.workId;

  const workActions =
    canRegisterFolder || canRegisterFile ? (
      <Button
        variant="primary"
        icon={I.add}
        disabled={registerPreviewMutation.isPending}
        onClick={() => {
          toast.dismiss();
          registerPreviewMutation.mutate(entry.path);
        }}
      >
        {isDir ? "このフォルダーを作品として登録" : "このファイルを作品として登録"}
      </Button>
    ) : (isWorkFolder || isSingleFileWork) && entry.workId ? (
      <Button
        variant="ghost"
        disabled={unregisterMutation.isPending}
        onClick={() => {
          toast.dismiss();
          setShowUnregisterConfirm(true);
        }}
      >
        作品登録を解除
      </Button>
    ) : null;

  const conflictingPaths = identityConflict?.paths.filter((path) => path !== entry.path) ?? [];

  return (
    <>
      {(playActions != null || workActions != null) && (
        <div className="mle-fprev__actions">
          {playActions}
          {workActions}
        </div>
      )}
      {identityConflict && entry.isDir && (
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

      {showRegisterDialog && registerPreview && (
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
            if (entry.workId) unregisterMutation.mutate(entry.workId);
          }}
          onCancel={() => setShowUnregisterConfirm(false)}
        />
      )}

      {showReassignConfirm && (
        <ConfirmDialog
          title="別作品として取り込む"
          message={`「${entry.path}」のWork IDを新しくして、別作品として取り込みます。再生履歴やタグなどのユーザー状態は引き継ぎません。`}
          confirmLabel="取り込む"
          onConfirm={() => reassignMutation.mutate(entry.path)}
          onCancel={() => setShowReassignConfirm(false)}
        />
      )}
    </>
  );
}
