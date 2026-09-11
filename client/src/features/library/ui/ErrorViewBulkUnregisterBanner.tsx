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
          title="欠損作品をまとめて登録解除"
          message={`ファイル欠損した作品 ${missingCount} 件のライブラリ登録を解除します。再生履歴・ブックマーク・タグなどのデータも消えます。音声などの物理ファイルは削除されません。ドライブ未接続などの一時的な欠損の場合、接続後に再スキャンすれば再登録できますが、解除した登録情報（タグ・レジューム位置など）は戻りません。`}
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
