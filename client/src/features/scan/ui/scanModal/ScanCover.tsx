import type { ReactNode } from "react";

/** 一覧の行のカバー枠。36px角で、画像がなければ斜線パターンを出す。 */
export default function ScanCover({ children }: { children?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={
        children
          ? "block size-9 shrink-0 overflow-hidden rounded-[5px]"
          : "block size-9 shrink-0 rounded-[5px] border border-line-soft bg-[image:var(--cover-none)]"
      }
    >
      {children}
    </span>
  );
}
