import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useLayoutEffect } from "react";
import Toast from "../../shared/ui/Toast";
import { toastRequestsAtom, type ToastRequest } from "../../shared/model/toastRequestsAtom";

const PRIORITY_ORDER = ["action", "notice", "background"] as const;

/**
 * 要求集合から今回表示する1件を選ぶ。variant="error"は発行元のpriorityに関わらず
 * 最優先（design-system.md「単一ホストの優先順位チェーン」）。同順位内はMapの挿入順で
 * 最後に登録されたものを選ぶ。
 */
function pickToastRequest(requests: Map<string, ToastRequest>): [string, ToastRequest] | null {
  let errorEntry: [string, ToastRequest] | null = null;
  const byPriority = new Map<(typeof PRIORITY_ORDER)[number], [string, ToastRequest]>();
  for (const entry of requests) {
    const [, request] = entry;
    if (request.variant === "error") {
      errorEntry = entry;
      continue;
    }
    byPriority.set(request.priority, entry);
  }
  if (errorEntry) return errorEntry;
  for (const priority of PRIORITY_ORDER) {
    const entry = byPriority.get(priority);
    if (entry) return entry;
  }
  return null;
}

// GlobalToastは要求集合（toastRequestsAtom）から1件を選んでToastへ渡すだけ。画面遷移
// 等の個別の振る舞いは各要求のonActionに閉じる（design-system.md「単一ホストの優先順位チェーン」）。
export default function GlobalToast() {
  const toastRequests = useAtomValue(toastRequestsAtom);
  const setToastRequests = useSetAtom(toastRequestsAtom);

  const dismissToastRequest = useCallback(
    (id: string, request: ToastRequest) => {
      setToastRequests((current) => {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      });
      request.onDismiss?.();
    },
    [setToastRequests],
  );

  const pickedEntry = pickToastRequest(toastRequests);
  const pickedId = pickedEntry?.[0] ?? null;

  useLayoutEffect(() => {
    const discarded = [...toastRequests].filter(([id]) => id !== pickedId);
    if (discarded.length === 0) return;
    setToastRequests((current) => {
      const next = new Map(current);
      for (const [id] of discarded) next.delete(id);
      return next;
    });
    for (const [, request] of discarded) request.onDismiss?.();
  }, [toastRequests, pickedId, setToastRequests]);

  if (!pickedEntry) return <Toast message={null} onDismiss={() => {}} />;

  const [id, request] = pickedEntry;
  return (
    <Toast
      requestKey={request.requestKey}
      message={request.message}
      variant={request.variant}
      actionLabel={request.actionLabel}
      onAction={request.onAction}
      onDismiss={() => dismissToastRequest(id, request)}
    />
  );
}
