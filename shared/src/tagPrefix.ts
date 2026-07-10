// タグ prefix 定義（タグ設定）の契約。
// ADR-0005: タグの特別扱い（軸表示・保護・ラベル・色）はコードでなく、
// ユーザーが編集できる設定データとして表現する。システムは初期値の投入のみを行う。
import { z } from "zod";

/** prefix に使えない予約軸ID。ビュー・組み込み軸（tag / year）と軸IDの名前空間を共有するため */
export const RESERVED_AXIS_IDS = [
  "all",
  "recent",
  "added",
  "fav",
  "unplayed",
  "missing",
  "tag",
  "year",
] as const;

/** prefix 名。正規形（trim + 小文字）へ変換した上で予約ID・不正文字を拒否する */
export const tagPrefixNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform((s) => s.toLowerCase())
  .refine((s) => !s.includes("/"), { message: "prefix にスラッシュは使えません" })
  .refine((s) => !(RESERVED_AXIS_IDS as readonly string[]).includes(s), {
    message: "予約された軸IDは prefix に使えません",
  })
  .refine((s) => !s.startsWith("smart-"), {
    message: "smart- で始まる prefix は使えません",
  });

export const tagPrefixSchema = z.object({
  /** 正規形（小文字）。軸IDとしてもそのまま使う */
  prefix: z.string(),
  label: z.string(),
  /** 表示色（デザイントークン名 or CSSカラー）。null はデフォルト表示 */
  color: z.string().nullable(),
  showAsAxis: z.boolean(),
  /** true のとき、この prefix に属するタグの削除・編集時に確認を挟む（ソフトガード） */
  protected: z.boolean(),
});
export type TagPrefix = z.infer<typeof tagPrefixSchema>;

export const tagPrefixCreateSchema = z.object({
  prefix: tagPrefixNameSchema,
  label: z.string().trim().min(1),
  color: z.string().nullable().default(null),
  showAsAxis: z.boolean().default(true),
  protected: z.boolean().default(false),
});
export type TagPrefixCreate = z.infer<typeof tagPrefixCreateSchema>;

export const tagPrefixUpdateSchema = z.object({
  label: z.string().trim().min(1).optional(),
  color: z.string().nullable().optional(),
  showAsAxis: z.boolean().optional(),
  protected: z.boolean().optional(),
});
export type TagPrefixUpdate = z.infer<typeof tagPrefixUpdateSchema>;

/** データ中に存在するが未登録の prefix（設定UIのサジェスト用） */
export const tagPrefixCandidateSchema = z.object({
  prefix: z.string(),
  count: z.number().int().nonnegative(),
});
export type TagPrefixCandidate = z.infer<typeof tagPrefixCandidateSchema>;

/** 初回起動時に seed する prefix 定義。投入後の変更・削除はユーザーの自由
 *  （seed 済みフラグで管理し、全削除しても再投入しない） */
export const DEFAULT_TAG_PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "サークル", label: "サークル", color: null, showAsAxis: true, protected: true },
  { prefix: "シリーズ", label: "シリーズ", color: null, showAsAxis: true, protected: false },
  { prefix: "カテゴリ", label: "カテゴリ", color: null, showAsAxis: true, protected: false },
  { prefix: "genre", label: "ジャンル", color: null, showAsAxis: false, protected: false },
];
