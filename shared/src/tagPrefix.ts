// タグ prefix 定義（タグ設定）の契約。
// ADR-0005: タグの特別扱い（軸表示・保護・ラベル・色）はコードでなく、
// ユーザーが編集できる設定データとして表現する。システムは初期値の投入のみを行う。
import { z } from "zod";

/** prefix に使えない予約軸ID。ビュー・組み込み軸（tag / year）と軸IDの名前空間を共有するため */
export const RESERVED_AXIS_IDS = ["all", "recent", "added", "fav", "error", "tag", "year"] as const;

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

/** タグ prefix の表示色キー。client が tokens.css の CSS 変数へ解決する */
export const TAG_PREFIX_COLOR_KEYS = ["cv", "circle", "series", "cat"] as const;
export const tagPrefixColorKeySchema = z.enum(TAG_PREFIX_COLOR_KEYS);
export type TagPrefixColorKey = z.infer<typeof tagPrefixColorKeySchema>;

export const tagPrefixSchema = z.object({
  /** 正規形（小文字）。軸IDとしてもそのまま使う */
  prefix: z.string(),
  label: z.string(),
  /** 表示色の semantic key。null は client 側のデフォルト表示 */
  color: tagPrefixColorKeySchema.nullable(),
  showAsAxis: z.boolean(),
  /** true のとき、この prefix に属するタグの削除・編集時に確認を挟む（ソフトガード） */
  protected: z.boolean(),
  /** 設定一覧・軸レールでの並び順。小さいほど先頭。作成時にサーバーが末尾へ自動採番する */
  order: z.number().int(),
});
export type TagPrefix = z.infer<typeof tagPrefixSchema>;
export const tagPrefixListSchema = z.array(tagPrefixSchema);

export const tagPrefixCreateSchema = z.object({
  prefix: tagPrefixNameSchema,
  label: z.string().trim().min(1),
  color: tagPrefixColorKeySchema.nullable().default(null),
  showAsAxis: z.boolean().default(true),
  protected: z.boolean().default(false),
});
export type TagPrefixCreate = z.infer<typeof tagPrefixCreateSchema>;

export const tagPrefixUpdateSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    color: tagPrefixColorKeySchema.nullable().optional(),
    showAsAxis: z.boolean().optional(),
    protected: z.boolean().optional(),
    order: z.number().int().optional(),
  })
  .refine(
    (patch) =>
      patch.label !== undefined ||
      patch.color !== undefined ||
      patch.showAsAxis !== undefined ||
      patch.protected !== undefined ||
      patch.order !== undefined,
  );
export type TagPrefixUpdate = z.infer<typeof tagPrefixUpdateSchema>;

/** データ中に存在するが未登録の prefix（設定UIのサジェスト用） */
export const tagPrefixCandidateSchema = z.object({
  prefix: z.string(),
  count: z.number().int().nonnegative(),
});
export type TagPrefixCandidate = z.infer<typeof tagPrefixCandidateSchema>;
export const tagPrefixCandidateListSchema = z.array(tagPrefixCandidateSchema);

/** 初回起動時に seed する prefix 定義。投入後の変更・削除はユーザーの自由
 *  （seed 済みフラグで管理し、全削除しても再投入しない）。
 *  color は client が CSS 変数へ解決する semantic key */
export const DEFAULT_TAG_PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true, order: 0 },
  {
    prefix: "サークル",
    label: "サークル",
    color: "circle",
    showAsAxis: true,
    protected: true,
    order: 1,
  },
  {
    prefix: "シリーズ",
    label: "シリーズ",
    color: "series",
    showAsAxis: true,
    protected: false,
    order: 2,
  },
  {
    prefix: "カテゴリ",
    label: "カテゴリ",
    color: "cat",
    showAsAxis: true,
    protected: false,
    order: 3,
  },
  {
    prefix: "genre",
    label: "ジャンル",
    color: "cat",
    showAsAxis: false,
    protected: false,
    order: 4,
  },
  {
    prefix: "rating",
    label: "レーティング",
    color: "cat",
    showAsAxis: true,
    protected: false,
    order: 5,
  },
];

export interface ResolvedTagPrefix {
  label: string;
  color: TagPrefixColorKey | null;
}

/** prefix 文字列に対応する表示ラベル・色を解決する。ADR-0005 のラベル・色は tagPrefixes
 *  設定データが正であり、この関数を通すことでタグチップ・軸レール・スマートフォルダー等の
 *  複数画面が同じ結果になる。未登録の prefix はラベルを prefix 文字列そのまま、色は
 *  null（呼び出し側の既定色）にする */
export function resolveTagPrefix(
  prefix: string,
  tagPrefixes: readonly TagPrefix[],
): ResolvedTagPrefix {
  const def = tagPrefixes.find((p) => p.prefix === prefix);
  return { label: def?.label ?? prefix, color: def?.color ?? null };
}
