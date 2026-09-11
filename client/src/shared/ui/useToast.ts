import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useSetAtom } from "jotai";
import { toastRequestsAtom, type ToastRequest } from "../model/toastRequestsAtom";

export interface UseToastResult {
  show: (request: ToastRequest) => void;
  /** variant="error"（自動消滅せず手動クローズのみ）で表示する。priorityは選択に関与しない
   *  （variant="error"が発行元のpriorityに関わらず最優先されるため）ので呼び出し側では指定しない */
  error: (message: string) => void;
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
  // 同じ呼び出し元から文面が同じ要求が続けて来ても別の要求として扱えるよう、
  // show() のたびに増える発行カウンタをキーへ含める（Toast.tsx側でReactのkeyとして
  // 使い、寿命タイマー・onDismissを要求ごとに独立させる）。
  const issueCountRef = useRef(0);

  const show = useCallback(
    (request: ToastRequest) => {
      issueCountRef.current += 1;
      const requestKey = `${id}:${issueCountRef.current}`;
      setRequests((current) => {
        const next = new Map(current);
        next.set(id, { ...request, requestKey });
        return next;
      });
    },
    [id, setRequests],
  );

  const error = useCallback(
    (message: string) => show({ message, variant: "error", priority: "notice" }),
    [show],
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

  return useMemo(() => ({ show, error, dismiss }), [show, error, dismiss]);
}
