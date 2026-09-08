import { atom } from "jotai";
import type { ToastVariant } from "../ui/Toast";

/**
 * "action": ユーザーが直前に行った操作の直接の結果（元に戻す・完了フィードバック等）。
 * "background": スキャン・DLsite一括取得等の非同期ジョブの結果通知。
 * 同時に両方が要求されたら action が勝つ。負けた background は表示されず破棄する
 * （別の場所から辿れることが前提。design-system.md参照）。
 */
export type ToastPriority = "action" | "background";

export interface ToastRequest {
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  /** GlobalToastがこの要求を手放す（手動close・自動消滅）ときに呼ぶ。呼び出し側の状態をここで消す */
  onDismiss?: () => void;
  priority: ToastPriority;
}

/** 呼び出し側ごとに一意なID（useToastのuseId）をキーにした表示要求の集合。GlobalToastが唯一の読み手 */
export const toastRequestsAtom = atom<Map<string, ToastRequest>>(new Map());
