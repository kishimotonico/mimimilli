import { z } from "zod";
import type { Cover } from "./work.ts";

/** 作品カバーのメタ・DB 境界（画像ファイル名と寸法列から導出） */
export const coverKindSchema = z.enum(["none", "unmeasured", "measured"]);
export type CoverKind = z.infer<typeof coverKindSchema>;

export function projectCoverKind(
  image: string | null,
  width: number | null,
  height: number | null,
): CoverKind {
  if (image === null) return "none";
  if (width !== null && height !== null) return "measured";
  return "unmeasured";
}

/** DB カバー列を表示用 cover と編集用フィールドへ投影する */
export function coverFieldsFromColumns(
  image: string | null,
  width: number | null,
  height: number | null,
): { cover: Cover; coverKind: CoverKind; coverImage: string | null } {
  const coverKind = projectCoverKind(image, width, height);
  const coverImage = image;
  const cover: Cover =
    coverKind === "measured"
      ? { image: image!, dimensions: { width: width!, height: height! } }
      : null;
  return { cover, coverKind, coverImage };
}

/** 表示用 cover から編集用フィールドを組み立てる（テスト・fixture 向け） */
export function coverFieldsFromCover(cover: Cover): {
  coverKind: CoverKind;
  coverImage: string | null;
} {
  if (cover === null) return { coverKind: "none", coverImage: null };
  return { coverKind: "measured", coverImage: cover.image };
}

/** 計測失敗（画像はあるが寸法未解決）かどうか */
export function isCoverUnmeasured(kind: CoverKind): boolean {
  return kind === "unmeasured";
}
