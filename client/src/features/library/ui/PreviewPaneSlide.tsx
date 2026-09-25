import type { ComponentProps } from "react";
import { motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import PreviewPane from "./PreviewPane";

type PreviewPaneSlideProps = ComponentProps<typeof PreviewPane>;

/** 作品選択プレビューが右から出入りする（ADR-0012 §3）。selectedWorkId が非nullの間だけ
 *  マウントされ、退出中もAnimatePresenceが凍結した最後のpropsのまま表示され続ける。 */
export default function PreviewPaneSlide(props: PreviewPaneSlideProps) {
  const { previewSlide } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = previewSlide();
  return (
    <motion.div className="mll-results__preview" inert={!isPresent} {...v}>
      <PreviewPane {...props} />
    </motion.div>
  );
}
