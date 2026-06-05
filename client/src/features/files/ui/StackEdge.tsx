// 受動スタック（背表紙）。末尾カラムより前の祖先を左端に畳んだ見た目。
// クリックで1つ上の階層へ戻る（パンくずの代替の軽い導線）。親フォルダー名を縦書きで表示。
// 子へ潜るたびに背表紙が軽くパルスして「カードが1枚吸い込まれた」感を出す。

import { motion } from "motion/react";

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
      animate={{ width: 64, opacity: 1 }}
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
        <span className="up">▲ 上へ</span>
        <span className="nm">{parentName}</span>
      </span>
    </motion.button>
  );
}
