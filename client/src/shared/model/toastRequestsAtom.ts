import { atom } from "jotai";
import type { ToastVariant } from "../ui/Toast";

/**
 * "action": ユーザーが直前に行った操作の直接の結果（元に戻す・完了フィードバック等）。
 * "notice": スキャン完了・ルートフォルダー変更等、アプリ全体に関わる単発の通知。
 * "background": スキャン・DLsite一括取得等の非同期ジョブの結果通知。
 * `variant: "error"` の要求は発行元がどの priority を渡しても最優先で選ばれる
 * （design-system.md「単一ホストの優先順位チェーン」）。
 * 優先順位で選ばれなかった要求はキューに積まず即座に破棄する。負けた情報は別の場所から
 * 辿れることが前提（AC参照）。破棄された要求も表示されて消えた要求と同じく onDismiss が呼ばれる。
 */
export type ToastPriority = "action" | "notice" | "background";

export interface ToastRequest {
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  /** GlobalToastがこの要求を手放す（表示後の手動close・自動消滅、または表示されないままの
   *  即時破棄）ときに呼ぶ。呼び出し側の状態をここで消す */
  onDismiss?: () => void;
  priority: ToastPriority;
  /** useToastが発行する一意キー（呼び出し元ID＋発行カウンタ）。Reactのkeyとして使い、
   *  同じ文面の再通知でも寿命タイマー・onDismissを新しい要求として独立させる */
  requestKey?: string;
  /** 既定(true)では発行元のアンマウント時にこの要求を取り下げる。操作の結果を伝えるだけの
   *  通知（発行元が直後に画面遷移で消えても表示を続けたいもの）はfalseを渡す */
  dismissOnUnmount?: boolean;
}

/** 呼び出し側ごとに一意なID（useToastのuseId）をキーにした表示要求の集合。GlobalToastが唯一の読み手 */
export const toastRequestsAtom = atom<Map<string, ToastRequest>>(new Map());
