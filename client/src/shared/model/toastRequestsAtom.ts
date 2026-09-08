import { atom } from "jotai";
import type { ToastVariant } from "../ui/Toast";

/**
 * "action": ユーザーが直前に行った操作の直接の結果（元に戻す・完了フィードバック等）。
 * "background": スキャン・DLsite一括取得等の非同期ジョブの結果通知。
 * 優先順位（error > action > 個別グローバル通知 > background）で選ばれなかった要求は
 * キューに積まず即座に破棄する（design-system.md「単一ホストの優先順位チェーン」）。
 * 負けた情報は別の場所から辿れることが前提（AC参照）。破棄された要求も表示されて
 * 消えた要求と同じく onDismiss が呼ばれる。
 */
export type ToastPriority = "action" | "background";

export interface ToastRequest {
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  /** GlobalToastがこの要求を手放す（表示後の手動close・自動消滅、または表示されないままの
   *  即時破棄）ときに呼ぶ。呼び出し側の状態をここで消す */
  onDismiss?: () => void;
  priority: ToastPriority;
}

/** 呼び出し側ごとに一意なID（useToastのuseId）をキーにした表示要求の集合。GlobalToastが唯一の読み手 */
export const toastRequestsAtom = atom<Map<string, ToastRequest>>(new Map());
