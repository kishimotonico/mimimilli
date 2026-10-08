import type { Cover, CoverKind } from "@mimimilli/shared";

/** 表示用 cover から編集用フィールドを組み立てる */
export function coverFieldsFromCover(cover: Cover): {
  coverKind: CoverKind;
  coverImage: string | null;
} {
  if (cover === null) return { coverKind: "none", coverImage: null };
  return { coverKind: "measured", coverImage: cover.image };
}
