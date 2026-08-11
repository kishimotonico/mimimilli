import { motion } from "motion/react";
import { useDialogModal } from "./useDialogModal";
import { useMotionVariants } from "./useMotionVariants";

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** 画像を画面全体にオーバーレイ拡大表示する（TASK-298）。ライブラリ詳細パネルの
 *  カバーサムネイル・ファイルモードの画像プレビューで共通に使う。 */
export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });
  const { popoverScale } = useMotionVariants();
  const v = popoverScale({ origin: "center" });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onCancel={handleCancel}
      onClick={(e) => handleBackdropClick(e)}
      className="m-0 flex h-screen max-h-none w-screen max-w-none items-center justify-center border-none bg-transparent p-0 backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <motion.img
        src={src}
        alt={alt}
        initial={v.initial}
        animate={v.animate}
        className="max-h-[92vh] max-w-[92vw] object-contain"
      />
    </dialog>
  );
}
