// 祖先スパイン（背表紙）。クリックで1つ上の階層へ戻る。
// ラベル（上向き矢印 + 親フォルダー名の縦書き）は束の一番右＝前面カードの上に置く。
// 子へ潜るたびに背表紙が軽くパルスして「カードが1枚吸い込まれた」感を出す。

import { motion } from "motion/react";
import { I } from "../../../shared/ui/Icon";

interface StackEdgeProps {
  parentName: string;
  /** カレント階層の深さ（変化時に背表紙をパルスさせる） */
  depth: number;
  onUp: () => void;
}

export default function StackEdge({ parentName, depth, onUp }: StackEdgeProps) {
  return (
    <motion.button
      type="button"
      className="mle-colstack"
      title={`1つ上の階層（${parentName}）へ戻る`}
      onClick={onUp}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 46, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="mle-colstack__edges"
        key={depth}
        initial={{ scale: 1.14, x: 7 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      >
        <span /><span /><span /><span />
      </motion.div>
      <span className="mle-colstack__label">
        <span className="up"><I.chevD size={13} style={{ transform: "rotate(180deg)" }} /></span>
        <span className="nm">{parentName}</span>
      </span>
    </motion.button>
  );
}
