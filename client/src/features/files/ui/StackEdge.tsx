// 祖先スパイン（背表紙）の中身。外側の出入りアニメーションは FilesView の AnimatePresence が担う。

import { useEffect, useState } from "react";
import { I } from "../../../shared/ui/Icon";

interface StackEdgeProps {
  parentName: string;
  /** カレント階層の深さ（変化時に背表紙をパルスさせる） */
  depth: number;
}

export default function StackEdge({ parentName, depth }: StackEdgeProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 280);
    return () => clearTimeout(timer);
  }, [depth]);

  return (
    <>
      <div className="mle-colstack__edges" data-pulse={pulse ? "enter" : undefined}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="mle-colstack__label">
        <span className="up">
          <I.chevD size={13} style={{ transform: "rotate(180deg)" }} />
        </span>
        <span className="nm">{parentName}</span>
      </span>
    </>
  );
}
