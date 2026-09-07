import { useSetAtom, useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { DlsiteApplyMissingPreviewItem } from "@mimimilli/shared";
import { applyDlsiteMissing, previewDlsiteMissing } from "../../../entities/work/api";
import {
  dlsiteBulkApplyBusyAtom,
  dlsiteBulkApplyOpenAtom,
  dlsiteBulkApplyResultAtom,
} from "../../../entities/dlsite/model/bulkAtoms";
import { errorToastAtom } from "../../../shared/model/errorToastAtom";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { formatDlsiteBulkApplyMissingResult } from "../model/formatDlsiteBulkApplyMissingResult";
import { invalidateDlsiteCache } from "../model/dlsiteInvalidation";
import DlsiteBulkApplyDialog from "./DlsiteBulkApplyDialog";

export default function DlsiteBulkApplyRuntime() {
  const queryClient = useQueryClient();
  const open = useAtomValue(dlsiteBulkApplyOpenAtom);
  const busy = useAtomValue(dlsiteBulkApplyBusyAtom);
  const setOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const setBusy = useSetAtom(dlsiteBulkApplyBusyAtom);
  const setResult = useSetAtom(dlsiteBulkApplyResultAtom);
  const setErrorToast = useSetAtom(errorToastAtom);
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
          setResult({ message: "DLsiteの情報は現在の内容と同じでした", variant: "info" });
          return;
        }
        setItems(preview.items);
        setSelectedWorkIds(new Set(preview.items.map((item) => item.workId)));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        reset();
        setErrorToast(apiErrorMessage(cause, "適用対象の差分を取得できませんでした"));
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
      const result = await applyDlsiteMissing([...selectedWorkIds]);
      reset();
      setResult({
        message: `未設定項目を適用: ${formatDlsiteBulkApplyMissingResult(result)}`,
        variant: "success",
      });
      await invalidateDlsiteCache(queryClient, [...selectedWorkIds]);
    } catch (cause) {
      reset();
      setErrorToast(apiErrorMessage(cause, "未設定項目の一括適用に失敗しました"));
    } finally {
      setBusy(false);
    }
  }, [queryClient, reset, selectedWorkIds, setBusy, setErrorToast, setResult]);

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
