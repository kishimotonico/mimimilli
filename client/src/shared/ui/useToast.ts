import { useCallback, useEffect, useId } from "react";
import { useSetAtom } from "jotai";
import { toastRequestsAtom, type ToastRequest } from "../model/toastRequestsAtom";

export interface UseToastResult {
  show: (request: ToastRequest) => void;
  dismiss: () => void;
}

/**
 * ローカルなトースト表示要求を単一ホスト（GlobalToast）へ届けるフック。表示位置
 * （dialog内/全体）の判定・複数要求が重なったときの優先順位・寿命管理はホスト側に一任し、
 * 呼び出し側は「何を表示したいか」だけを宣言する（design-system.md「単一ホストの優先順位チェーン」）。
 * アンマウント時は自分の要求を取り下げる。
 */
export function useToast(): UseToastResult {
  const id = useId();
  const setRequests = useSetAtom(toastRequestsAtom);

  const show = useCallback(
    (request: ToastRequest) => {
      setRequests((current) => {
        const next = new Map(current);
        next.set(id, request);
        return next;
      });
    },
    [id, setRequests],
  );

  const dismiss = useCallback(() => {
    setRequests((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, [id, setRequests]);

  useEffect(() => dismiss, [dismiss]);

  return { show, dismiss };
}
