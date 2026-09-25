import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { FILE_SYSTEM_QUERY_KEYS } from "../../../entities/file-system/queryKeys";
import { SCAN_QUERY_KEYS } from "../../../entities/scan/queryKeys";
import {
  useReassignWorkIdentityMutation,
  useUnregisterWorkMutation,
} from "../../../entities/work/model/workMutations";
import { getWorkRegisterPreview } from "../api";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useIdentityConflictFor } from "../model/useIdentityConflict";
import RegisterWorkDialog from "./RegisterWorkDialog";
import { SourceProjectionNotice } from "../../../entities/work/ui/SourceProjectionNotice";
import { sourceMutationErrorMessage } from "../../../entities/work/sourceMutation";
import type {
  ScanDiagnostic,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkspacePath,
} from "@mimimilli/shared";
import { classifyFile, isWorkFolder, isSingleFileWork, type FsEntry } from "../model/types";

interface FilePreviewWorkActionsProps {
  entry: FsEntry;
  /** 再生ボタン等、登録ワークフロー以外のアクション。存在すれば登録ボタンと同じ行に並ぶ */
  playActions: ReactNode;
  onWorkRegistered?: () => void | Promise<unknown>;
}

interface IdentityConflictSectionProps {
  identityConflict: ScanDiagnostic;
  currentPath: string;
  reassignDisabled: boolean;
  onReassign: () => void;
}

/** ID重複セクション。identityConflictがある（＝entryがdirで重複がある）ときだけ描画される
 *  ので、他のpathsとの絞り込みをnon-nullな引数として受け取れる */
function IdentityConflictSection({
  identityConflict,
  currentPath,
  reassignDisabled,
  onReassign,
}: IdentityConflictSectionProps) {
  const conflictingPaths = identityConflict.paths.filter((path) => path !== currentPath);
  return (
    <section className="mle-identity-conflict" aria-label="ID重複">
      <span className="mle-identity-conflict-badge">ID重複</span>
      <p>同じWork IDを持つフォルダーがあります。</p>
      <div className="mle-identity-conflict__paths">
        {conflictingPaths.map((path) => (
          <code key={path}>{path}</code>
        ))}
      </div>
      <Button variant="primary" disabled={reassignDisabled} onClick={onReassign}>
        別作品として取り込む
      </Button>
    </section>
  );
}

/** 作品登録ワークフロー（登録・解除・ID重複の取り込み）を一括で扱う。mutation・確認/登録
 *  ダイアログ・アクション行・ID重複セクションの描画までをここに閉じる（メディア
 *  描画（FilePreviewMedia.tsx）とはここで境界を分ける）。 */
export default function FilePreviewWorkActions({
  entry,
  playActions,
  onWorkRegistered,
}: FilePreviewWorkActionsProps) {
  const identityConflict = useIdentityConflictFor(entry.path);
  const isDir = classifyFile(entry) === "dir";
  const kind = classifyFile(entry);
  const isWorkFolderEntry = isWorkFolder(entry);
  const isSingleFileWorkEntry = isSingleFileWork(entry);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [registerPreview, setRegisterPreview] = useState<WorkRegisterPreview | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [pendingProjection, setPendingProjection] = useState<WorkSourceMutationResult | null>(null);

  const unregisterMutation = useUnregisterWorkMutation();
  const unregister = async (workId: string) => {
    try {
      await unregisterMutation.mutateAsync(workId, {
        onSuccess: () => setShowUnregisterConfirm(false),
      });
    } catch (cause) {
      toast.error(apiErrorMessage(cause, "作品登録の解除に失敗しました"));
      return;
    }
    await onWorkRegistered?.();
  };

  const reassignMutation = useReassignWorkIdentityMutation();
  const reassign = async (path: WorkspacePath) => {
    try {
      await reassignMutation.mutateAsync(path, {
        onSuccess: (result) => {
          setShowReassignConfirm(false);
          setPendingProjection(result);
        },
      });
    } catch (cause) {
      toast.error(sourceMutationErrorMessage(cause, "別作品としての取り込みに失敗しました"));
      return;
    }
    await onWorkRegistered?.();
  };

  const registerPreviewMutation = useMutation({
    mutationFn: (path: WorkspacePath) => getWorkRegisterPreview(path),
    onSuccess: async (preview) => {
      if (preview.alreadyRegistered) {
        toast.error("この場所は既に作品として登録されています");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: FILE_SYSTEM_QUERY_KEYS.all() }),
          queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() }),
        ]);
        await onWorkRegistered?.();
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
    ) : (isWorkFolderEntry || isSingleFileWorkEntry) && entry.workId ? (
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

  return (
    <>
      {(playActions != null || workActions != null) && (
        <div className="mle-fprev__actions">
          {playActions}
          {workActions}
        </div>
      )}
      {pendingProjection && (
        <SourceProjectionNotice
          projection={pendingProjection.projection}
          path={entry.path}
          onProjected={setPendingProjection}
        />
      )}
      {identityConflict && entry.isDir && (
        <IdentityConflictSection
          identityConflict={identityConflict}
          currentPath={entry.path}
          reassignDisabled={reassignMutation.isPending}
          onReassign={() => setShowReassignConfirm(true)}
        />
      )}

      {showRegisterDialog && registerPreview && (
        <RegisterWorkDialog
          folderPath={entry.path}
          targetKind={isDir ? "folder" : "file"}
          preview={registerPreview}
          onRegistered={(result) => {
            setPendingProjection(result);
            void onWorkRegistered?.();
          }}
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
            isSingleFileWorkEntry
              ? "このファイルの作品データ（再生履歴・タグを含む）と管理ファイル（.mimimilli.json）を削除します。音声ファイル自体は削除されません。"
              : "このフォルダーの作品データ（再生履歴・タグを含む）と管理ファイル（mimimilli.json）を削除します。音声などの物理ファイルは削除されません。"
          }
          confirmLabel="解除する"
          onConfirm={() => {
            if (entry.workId) void unregister(entry.workId);
          }}
          onCancel={() => setShowUnregisterConfirm(false)}
        />
      )}

      {showReassignConfirm && (
        <ConfirmDialog
          title="別作品として取り込む"
          message={`「${entry.path}」のWork IDを新しくして、別作品として取り込みます。再生履歴やタグなどのユーザー状態は引き継ぎません。`}
          confirmLabel="取り込む"
          onConfirm={() => void reassign(entry.path)}
          onCancel={() => setShowReassignConfirm(false)}
        />
      )}
    </>
  );
}
