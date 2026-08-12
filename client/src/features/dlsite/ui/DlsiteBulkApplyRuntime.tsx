import { useSetAtom, useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { applyDlsiteMissing } from "../../../entities/work/api";
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

  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy, setOpen]);

  const apply = useCallback(async () => {
    setBusy(true);
    try {
      const result = await applyDlsiteMissing();
      setOpen(false);
      setResult(`未設定項目を適用: ${formatDlsiteBulkApplyMissingResult(result)}`);
      await invalidateDlsiteCache(queryClient);
    } catch (cause) {
      setOpen(false);
      setErrorToast(apiErrorMessage(cause, "未設定項目の一括適用に失敗しました"));
    } finally {
      setBusy(false);
    }
  }, [queryClient, setBusy, setErrorToast, setOpen, setResult]);

  if (!open) return null;

  return <DlsiteBulkApplyDialog busy={busy} onApply={() => void apply()} onClose={close} />;
}
