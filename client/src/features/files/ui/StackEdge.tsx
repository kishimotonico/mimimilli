// 背表紙1枚の中身。外側の出入りアニメーションは AncestorStack の AnimatePresence が担う。

import { useEffect, useState } from "react";
import { I } from "../../../shared/ui/Icon";

interface StackEdgeProps {
  label: string;
  /** 束の先頭（root側）だけに残す4層の縁の演出。それ以外はフラットな単一カード。 */
  showEdges: boolean;
  /** 省略スロットのアイコン（「…」）。既定は通常の上向きchevron。 */
  isEllipsis?: boolean;
  /** 変化するたびパルスさせるキー。undefinedならパルスしない
   *  （深さ変化のパルスは現在地に最も近い1枚だけに掛ける仕様のため）。 */
  pulseKey?: string | number;
}

export default function StackEdge({ label, showEdges, isEllipsis, pulseKey }: StackEdgeProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseKey === undefined) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 280);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  return (
    <>
      {showEdges ? (
        <div className="mle-colstack__edges">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="mle-colstack__card" data-pulse={pulse ? "enter" : undefined} />
      )}
      <span className="mle-colstack__label">
        <span className="up">
          {isEllipsis ? (
            <I.more size={13} />
          ) : (
            <I.chevD size={13} style={{ transform: "rotate(180deg)" }} />
          )}
        </span>
        <span className="nm">{label}</span>
      </span>
    </>
  );
}
