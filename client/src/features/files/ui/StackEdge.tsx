// 受動スタック（背表紙）。末尾カラムより前の祖先を左端に畳んだ見た目だけを示す。
// 正典 README 準拠でクリック非対応。階層移動はパンくず（アドレスバー）から。
// 出現/消滅は motion でアニメーション（子へ潜ると親がここへ吸い込まれる先）。

import { motion } from "motion/react";

export default function StackEdge() {
  return (
    <motion.div
      className="mle-colstack"
      title="前の階層はスタック。移動はパンくずから"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 38, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="mle-colstack__edges">
        <span /><span /><span /><span />
      </div>
    </motion.div>
  );
}
