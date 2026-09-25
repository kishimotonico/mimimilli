import { useSetAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import type { DlsiteApplyMissingPreviewItem } from "@mimimilli/shared";
import { previewDlsiteMissing } from "../../../entities/work/api";
import { useApplyDlsiteMissingMutation } from "../../../entities/work/model/workMutations";
import {
  dlsiteBulkApplyBusyAtom,
  dlsiteBulkApplyOpenAtom,
} from "../../../entities/dlsite/model/bulkAtoms";
import { useToast } from "../../../shared/ui/useToast";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { sourceMutationErrorMessage } from "../../../entities/work/sourceMutation";
import { formatDlsiteBulkApplyMissingResult } from "../model/formatDlsiteBulkApplyMissingResult";
import DlsiteBulkApplyDialog from "./DlsiteBulkApplyDialog";

export default function DlsiteBulkApplyRuntime() {
  const applyMutation = useApplyDlsiteMissingMutation();
  const open = useAtomValue(dlsiteBulkApplyOpenAtom);
  const busy = useAtomValue(dlsiteBulkApplyBusyAtom);
  const setOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const setBusy = useSetAtom(dlsiteBulkApplyBusyAtom);
  const toast = useToast();
  const [items, setItems] = useState<DlsiteApplyMissingPreviewItem[] | null>(null);
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setOpen(false);
    setItems(null);
    setSelectedWorkIds(new Set());
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    void previewDlsiteMissing()
      .then((preview) => {
        if (cancelled) return;
        if (preview.items.length === 0) {
          reset();
          toast.show({
            message: "DLsiteの情報は現在の内容と同じでした",
            variant: "info",
            priority: "notice",
          });
          return;
        }
        setItems(preview.items);
        setSelectedWorkIds(new Set(preview.items.map((item) => item.workId)));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        reset();
        toast.error(apiErrorMessage(cause, "適用対象の差分を取得できませんでした"));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openの立ち上がり時だけ実行する
  }, [open]);

  const toggleWorkId = useCallback((workId: string, checked: boolean) => {
    setSelectedWorkIds((current) => {
      const next = new Set(current);
      if (checked) next.add(workId);
      else next.delete(workId);
      return next;
    });
  }, []);

  const apply = useCallback(async () => {
    setBusy(true);
    try {
      const result = await applyMutation.mutateAsync([...selectedWorkIds]);
      reset();
      toast.show({
        message: `未設定項目を適用: ${formatDlsiteBulkApplyMissingResult(result)}`,
        variant: "success",
        priority: "notice",
      });
    } catch (cause) {
      reset();
      toast.error(sourceMutationErrorMessage(cause, "未設定項目の一括適用に失敗しました"));
    } finally {
      setBusy(false);
    }
  }, [applyMutation, reset, selectedWorkIds, setBusy, toast]);

  if (!open || !items) return null;

  return (
    <DlsiteBulkApplyDialog
      items={items}
      selectedWorkIds={selectedWorkIds}
      busy={busy}
      onToggleWorkId={toggleWorkId}
      onApply={() => void apply()}
      onClose={reset}
    />
  );
}
