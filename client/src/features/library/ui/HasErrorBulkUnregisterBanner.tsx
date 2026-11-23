import { useState } from "react";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { useToast } from "../../../shared/ui/useToast";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useUnregisterMissingWorksMutation } from "../../../entities/work/model/workMutations";

interface HasErrorBulkUnregisterBannerProps {
  missingCount: number | undefined;
}

/** エラーの行を開いていて、missing作品が1件以上あるときだけ出す一括登録解除導線 */
export function HasErrorBulkUnregisterBanner({ missingCount }: HasErrorBulkUnregisterBannerProps) {
  const mutation = useUnregisterMissingWorksMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const toast = useToast();
  const unregisterMissing = async () => {
    try {
      await mutation.mutateAsync();
    } catch (cause) {
      toast.error(apiErrorMessage(cause, "行方不明の作品の登録解除に失敗しました"));
      return;
    }
  };
  if (!missingCount) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[6px] border border-line-soft bg-paper-2 px-3 py-2">
      <span className="font-jp text-body text-ink-1">
        行方不明の作品が <b className="text-ink-0">{missingCount}</b> 件あります
      </span>
      <Button
        variant="ghost"
        onClick={() => setIsConfirmOpen(true)}
        disabled={mutation.isPending}
        className="shrink-0 text-[color:var(--r-coral)]"
      >
        まとめて登録解除
      </Button>
      {isConfirmOpen && (
        <ConfirmDialog
          title="登録解除"
          message={`${missingCount}件の作品をライブラリから外します。タグや再生履歴（mimimilli.json）は消え、音声などのファイルは残ります。`}
          confirmLabel="まとめて解除する"
          onConfirm={() => {
            setIsConfirmOpen(false);
            void unregisterMissing();
          }}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </div>
  );
}
