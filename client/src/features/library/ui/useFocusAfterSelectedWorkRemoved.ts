import { useEffect, useRef, type RefObject } from "react";
import type { WorkListItem } from "@mimimilli/shared";

const MAX_WAIT_FRAMES = 60;

/**
 * 選択中の作品が一覧から消えた（登録解除など）とき、詳細ごとトリガーが無くなってフォーカスが
 * body に落ちたら、同じ位置に繰り上がった行（末尾なら前の行）へ移す。詳細は退出アニメーションの間
 * inert になってから外れるので、フォーカスが落ちるまで数フレーム待つ。
 */
export function useFocusAfterSelectedWorkRemoved(
  works: readonly WorkListItem[],
  selectedWorkId: string | null,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const lastSelected = useRef<{ id: string; index: number } | null>(null);

  useEffect(() => {
    const index = works.findIndex((work) => work.id === selectedWorkId);
    if (selectedWorkId !== null && index >= 0) {
      lastSelected.current = { id: selectedWorkId, index };
      return;
    }
    const gone = lastSelected.current;
    if (!gone || selectedWorkId !== null || works.some((work) => work.id === gone.id)) return;
    lastSelected.current = null;

    const focusNeighbor = () => {
      const container = scrollRef.current;
      const nextIndex = Math.min(gone.index, works.length - 1);
      const target =
        container?.querySelector<HTMLElement>(`[data-flat-index="${nextIndex}"]`) ??
        container?.querySelector<HTMLElement>('[data-flat-index][tabindex="0"]');
      target?.focus({ preventScroll: true });
    };

    let frame = 0;
    const wait = () => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) {
        focusNeighbor();
        return;
      }
      // 退出中の詳細にフォーカスが残っているあいだは待つ。一覧の中に移っていれば何もしない
      if (scrollRef.current?.contains(active) || frame++ >= MAX_WAIT_FRAMES) return;
      requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  }, [works, selectedWorkId, scrollRef]);
}
