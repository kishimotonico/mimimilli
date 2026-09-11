import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// styles/tailwind.css の @theme inline にある --text-* 定義と1対1で対応する。既定のfont-sizeグループは
// xs/sm/base等の既定スケール名しか認識せず、未登録のままだとtext-colorグループへ誤って分類され、
// 色ユーティリティ（text-ink-*等）と衝突してどちらかが消える。一覧のずれはcn.test.tsでCSS側と突き合わせて縛る。
export const FONT_SIZE_TOKENS = [
  "text-body",
  "text-secondary",
  "text-caption",
  "text-control",
  "text-label",
  "text-mono",
  "text-badge",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: ["rounded-1", "rounded-2", "rounded-3", "rounded-4", "rounded-pill"],
      "font-size": [...FONT_SIZE_TOKENS],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
