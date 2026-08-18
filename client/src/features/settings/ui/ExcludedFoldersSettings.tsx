// 設定モーダル内の「候補から外したフォルダー」セクション（TASK-330）。
// スキャンの未登録タブで「候補から外す」と user DB へ永続化され、二度と候補に出てこなくなる。
// 後から気づいた場合の唯一の救済手段として、一覧と解除をここに置く。
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getScanCandidateExclusions,
  restoreScanCandidateExclusions,
  SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY,
} from "../../../entities/scan/api";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import Button from "../../../shared/ui/Button";
import Toast from "../../../shared/ui/Toast";
import { apiErrorMessage } from "../../../shared/lib/apiError";

const SECTION_LABEL_CLASS =
  "font-sans text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase";

export default function ExcludedFoldersSettings() {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoredToast, setRestoredToast] = useState<string | null>(null);

  const exclusionsQuery = useQuery({
    queryKey: SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY,
    queryFn: getScanCandidateExclusions,
  });
  const exclusions = exclusionsQuery.data ?? [];

  const restoreMutation = useMutation({
    mutationFn: (path: string) => restoreScanCandidateExclusions([path]),
    onSuccess: async (_void, path) => {
      setErrorMessage(null);
      setRestoredToast(path);
      await refreshScanCandidates(queryClient);
    },
    onError: (error: unknown) => setErrorMessage(apiErrorMessage(error, "解除に失敗しました")),
  });

  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_LABEL_CLASS}>候補から外したフォルダー</span>

      <div className="flex max-h-[160px] flex-col overflow-y-auto rounded-[6px] border border-line-soft bg-paper-0">
        {exclusions.length === 0 ? (
          <span className="px-3 py-2.5 text-[11.5px] text-ink-3">
            候補から外したフォルダーはありません
          </span>
        ) : (
          exclusions.map((path) => (
            <div
              key={path}
              className="flex items-center gap-2.5 border-b border-line-soft px-2.5 py-1.5 last:border-b-0"
            >
              <span
                dir="rtl"
                title={path}
                className="mll-selectable min-w-0 flex-1 overflow-hidden text-left font-mono text-[11px] text-ellipsis whitespace-nowrap text-ink-2"
              >
                {path}
              </span>
              <Button
                variant="ghost"
                aria-label={`「${path}」を候補に戻す`}
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(path)}
              >
                戻す
              </Button>
            </div>
          ))
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="mll-selectable m-0 text-[11px] text-[var(--r-coral)]">
          {errorMessage}
        </p>
      )}

      <Toast
        message={restoredToast ? `「${restoredToast}」を候補に戻しました` : null}
        onDismiss={() => setRestoredToast(null)}
      />
    </div>
  );
}
