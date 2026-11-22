// ライブラリ（並び順・値一覧）の契約。
import { z } from "zod";
import { coverValueSchema } from "./cover.ts";

export { compareUtf8Bytes } from "./text.ts";

// ── ソート ───────────────────────────────────────────────────

export const sortIdSchema = z.enum([
  "added-desc",
  "added-asc",
  "title-asc",
  "title-desc",
  "duration-desc",
  "duration-asc",
  "last-played",
  "random",
  "id-asc",
]);
export type SortId = z.infer<typeof sortIdSchema>;

/** random ソート用 seed の上限。契約（GET /smart-folders/:id/works の seed）の範囲と同じ */
export const MAX_RANDOM_SEED = 0x7fffffff;

export function isRandomSeed(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_RANDOM_SEED;
}

/** random ソート用 seed。0 以上 MAX_RANDOM_SEED 以下の整数。 */
export function createRandomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & MAX_RANDOM_SEED;
}

// ── 値一覧 ───────────────────────────────────────────────────

/** 値一覧の代表カバー1件。カバー画像配信（GET /media/cover/:id）が作品単位のルートしか
 *  持たないため、コラージュ描画に必要な workId を持たせる（coverValueSchema 単体には無い）。 */
export const groupValueCoverSchema = coverValueSchema.extend({ workId: z.string() });
export type GroupValueCover = z.infer<typeof groupValueCoverSchema>;

export const groupValueItemSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
  /** その値に属する全作品の再生時間合計（秒）。totalDurationSec が未知（null）の作品は合算から除く */
  durationSec: z.number().nonnegative(),
  /** 代表カバー。追加日時の新しい順で最大4件、cover未設定の作品は含まない */
  covers: z.array(groupValueCoverSchema).max(4),
});
export type GroupValueItem = z.infer<typeof groupValueItemSchema>;
export const groupValueListSchema = z.array(groupValueItemSchema);
