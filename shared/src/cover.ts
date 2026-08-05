import { z } from "zod";

/**
 * 表示可能なカバー画像。image は作品ルート相対のファイル名、dimensions は EXIF 回転適用後の
 * 表示ピクセル寸法（単位 px）。
 */
export const coverValueSchema = z.object({
  image: z.string(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

/** カバー未設定・計測失敗はいずれも null に投影する
 * （「表示可能なカバーが無い」を意味し、UI は正方形プレースホルダで表す）。 */
export const coverSchema = coverValueSchema.nullable();
export type Cover = z.infer<typeof coverSchema>;

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
