import { useEffect, useRef } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

interface UseRevealSelectedWorkOptions {
  selectedWorkId: string | null;
  /** 一覧の内容が切り替わったことを表すキー（変化時に選択作品、無ければ先頭へ寄せる） */
  resetKey: string;
  /** 一覧内の選択作品のフラットインデックス（一覧に無ければ-1） */
  selectedIndex: number;
  /** 選択作品の行インデックス。行位置が未解決（ジャスティファイド未計算等）ならundefined */
  selectedRowIndex: number | undefined;
  /** 行位置の計算に必要な寸法（コンテナ幅など）が確定している */
  isLayoutReady: boolean;
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, "scrollToIndex" | "scrollToOffset">;
}

type PendingReveal = "selection" | "reset" | null;

// 作品一覧のスクロールを、次のきっかけでだけ動かす。列数・タイルサイズ・データ参照の
// 変化や選択解除では動かさない（位置はユーザーのもの）。
//  - mount時に選択がある / selectedWorkIdが別の非null値へ変わった: 選択作品を画面内へ
//  - resetKeyが変わった: 選択作品が一覧にあればそこへ、無ければ先頭へ
// 行位置が解決できていない間は要求を保留し、解決できた時点で一度だけ動かす。
// 作品一覧ではresetKey時の先頭リセットもここが担う（汎用のresetKeyは渡さない）。
export function useRevealSelectedWork({
  selectedWorkId,
  resetKey,
  selectedIndex,
  selectedRowIndex,
  isLayoutReady,
  virtualizer,
}: UseRevealSelectedWorkOptions): void {
  const pendingRef = useRef<PendingReveal>(selectedWorkId !== null ? "selection" : null);
  const prevRef = useRef({ selectedWorkId, resetKey });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { selectedWorkId, resetKey };
    if (prev.resetKey !== resetKey) {
      pendingRef.current = "reset";
    } else if (prev.selectedWorkId !== selectedWorkId) {
      if (selectedWorkId !== null) pendingRef.current = "selection";
      else if (pendingRef.current === "selection") pendingRef.current = null;
    }

    const pending = pendingRef.current;
    if (pending === null || !isLayoutReady) return;

    if (selectedIndex >= 0) {
      if (selectedRowIndex === undefined) return;
      virtualizer.scrollToIndex(selectedRowIndex, { align: "auto" });
    } else if (pending === "reset") {
      virtualizer.scrollToOffset(0);
    } else {
      return;
    }
    pendingRef.current = null;
  });
}
