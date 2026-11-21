import { useState } from "react";
import {
  isSidecarMetaFileName,
  META_SIDECAR_SUFFIX,
  pathBaseName,
  type WorkspacePath,
} from "@mimimilli/shared";
import {
  useReassignWorkIdentityMutation,
  useReloadWorkMutation,
  useUnregisterWorkMutation,
} from "../../../../entities/work/model/workMutations";
import { sourceMutationErrorMessage } from "../../../../entities/work/sourceMutation";
import { ApiRequestError } from "../../../../shared/api/http";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import Button from "../../../../shared/ui/Button";
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import { useToast } from "../../../../shared/ui/useToast";

function useOutcomeToast() {
  const toast = useToast();
  return (message: string, variant: "success" | "warning") =>
    toast.show({ message, variant, priority: "action", dismissOnUnmount: false });
}

function conflictTargetName(path: string): string {
  const name = pathBaseName(path);
  return isSidecarMetaFileName(name) ? name.slice(0, -META_SIDECAR_SUFFIX.length) : name;
}

export function ReassignIdentityButton({ path }: { path: WorkspacePath }) {
  const toast = useToast();
  const outcome = useOutcomeToast();
  const mutation = useReassignWorkIdentityMutation();
  const [confirming, setConfirming] = useState(false);
  const reassign = async () => {
    try {
      await mutation.mutateAsync(path);
    } catch (cause) {
      toast.error(sourceMutationErrorMessage(cause, "別の作品として取り込めませんでした"));
      setConfirming(false);
      return;
    }
    outcome(`「${conflictTargetName(path)}」を別の作品として取り込みました`, "success");
    setConfirming(false);
  };
  return (
    <>
      <Button size="sm" disabled={mutation.isPending} onClick={() => setConfirming(true)}>
        別の作品として取り込む
      </Button>
      {confirming && (
        <ConfirmDialog
          title="別の作品として取り込む"
          message={`「${path}」の作品IDを新しくして、別の作品として取り込みます。再生履歴やタグなどのユーザー状態は引き継ぎません。`}
          confirmLabel="取り込む"
          onConfirm={() => void reassign()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

export function ReloadWorkButton({ workId, label }: { workId: string; label: string }) {
  const toast = useToast();
  const outcome = useOutcomeToast();
  const mutation = useReloadWorkMutation();
  const reload = async () => {
    try {
      await mutation.mutateAsync(workId);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "reload_unresolved") {
        outcome(`「${label}」はまだ読み取れません`, "warning");
      } else {
        toast.error(apiErrorMessage(cause, "作品を読み直せませんでした"));
      }
      return;
    }
    outcome(`「${label}」を読み直しました`, "success");
  };
  return (
    <Button size="sm" disabled={mutation.isPending} onClick={() => void reload()}>
      読み直す
    </Button>
  );
}

export function UnregisterWorkButton({ workId, title }: { workId: string; title: string }) {
  const toast = useToast();
  const outcome = useOutcomeToast();
  const mutation = useUnregisterWorkMutation();
  const [confirming, setConfirming] = useState(false);
  const unregister = async () => {
    try {
      await mutation.mutateAsync(workId);
    } catch (cause) {
      toast.error(apiErrorMessage(cause, "登録解除に失敗しました"));
      setConfirming(false);
      return;
    }
    outcome(`「${title}」を登録解除しました`, "success");
    setConfirming(false);
  };
  return (
    <>
      <Button size="sm" disabled={mutation.isPending} onClick={() => setConfirming(true)}>
        登録解除
      </Button>
      {confirming && (
        <ConfirmDialog
          title="登録解除"
          message={`「${title}」をライブラリから外します。タグや再生履歴は消えます。`}
          confirmLabel="解除する"
          onConfirm={() => void unregister()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
