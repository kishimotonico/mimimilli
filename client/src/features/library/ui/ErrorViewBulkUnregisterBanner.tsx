import { useState } from "react";
import { useSetAtom } from "jotai";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { errorToastAtom } from "../../../shared/model/errorToastAtom";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import type { useLibraryBulkUnregisterMissingMutation } from "../model/useLibraryQueries";

interface ErrorViewBulkUnregisterBannerProps {
  missingCount: number | undefined;
  mutation: ReturnType<typeof useLibraryBulkUnregisterMissingMutation>;
}

/** エラービュー表示中、missing作品が1件以上あるときだけ出す一括登録解除導線 */
export function ErrorViewBulkUnregisterBanner({
  missingCount,
  mutation,
}: ErrorViewBulkUnregisterBannerProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const setErrorToast = useSetAtom(errorToastAtom);
  if (!missingCount) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[6px] border border-line-soft bg-paper-2 px-3 py-2">
      <span className="font-jp text-body text-ink-1">
        ファイル欠損した作品が <b className="text-ink-0">{missingCount}</b> 件あります
      </span>
      <Button
        variant="ghost"
        onClick={() => setIsConfirmOpen(true)}
        disabled={mutation.isPending}
        className="shrink-0 text-[color:var(--r-coral)]"
      >
        欠損作品をまとめて登録解除
      </Button>
      {isConfirmOpen && (
        <ConfirmDialog
          title="登録を解除"
          message={`${missingCount}件の作品をライブラリから外します。タグや再生履歴は消え、音声などのファイルは残ります。`}
          confirmLabel="まとめて解除する"
          onConfirm={() => {
            setIsConfirmOpen(false);
            mutation.mutate(undefined, {
              onError: (cause) =>
                setErrorToast(apiErrorMessage(cause, "欠損作品の一括登録解除に失敗しました")),
            });
          }}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </div>
  );
}
