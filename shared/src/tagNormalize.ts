// タグ正規化の核（NormalizedTag・normalizeTag・読み出し検証スキーマ）。
// work.ts / dlsite.ts 双方から参照するため、循環 import を避ける独立モジュールに置く。
import { z } from "zod";

/**
 * normalizeTag/normalizeTags を通した後だけ得られる型（parse, don't validate）。
 * タグの同一性判定・擬似タグ判定など、正規化済みであることを前提とする処理はこの型だけを
 * 受け取り、素の string を渡すとコンパイルエラーになる。素の string を扱ってよいのは
 * 境界（HTTPスキーマ・URL復元・ファイル読み込み・外部連携の入口）だけで、境界の内側は
 * すべてこの型で受け渡す。「正規化を忘れない」という規律への依存を型で置き換える。
 */
export type NormalizedTag = string & { readonly __normalizedTagBrand: unique symbol };

const EDGE_WHITESPACE = /^\s|\s$/u;

/** 読み出しバッチ用 normalizeTag メモ化。スコープ外ではキャッシュを使わない。 */
let activeNormalizeTagBatchCache: Map<string, NormalizedTag | null> | null = null;

/** 1回の読み出しバッチ中だけ normalizeTag をメモ化する。終了時（例外時も）必ず破棄する。 */
export function withNormalizeTagBatchCache<T>(fn: () => T): T {
  const cache = new Map<string, NormalizedTag | null>();
  const previous = activeNormalizeTagBatchCache;
  activeNormalizeTagBatchCache = cache;
  try {
    return fn();
  } finally {
    activeNormalizeTagBatchCache = previous;
  }
}

/** テスト用。バッチキャッシュが有効かどうかとエントリ数を返す。 */
export function getNormalizeTagBatchCacheStateForTests(): { active: boolean; size: number } {
  const cache = activeNormalizeTagBatchCache;
  return { active: cache !== null, size: cache?.size ?? 0 };
}

function hasEdgeWhitespace(s: string): boolean {
  return EDGE_WHITESPACE.test(s);
}

function normalizeTagCore(tag: string): NormalizedTag | null {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    const rawPrefix = tag.slice(0, idx);
    const rawValue = tag.slice(idx + 1);
    if (!rawPrefix || !rawValue) return null;

    if (!hasEdgeWhitespace(rawPrefix) && !hasEdgeWhitespace(rawValue)) {
      const prefixLower = rawPrefix.toLowerCase();
      if (rawPrefix === prefixLower) {
        return tag as NormalizedTag;
      }
      return `${prefixLower}/${rawValue}` as NormalizedTag;
    }

    const prefix = rawPrefix.trim().toLowerCase();
    const value = rawValue.trim();
    if (!prefix || !value) return null;
    if (rawPrefix === prefix && rawValue === value) {
      return tag as NormalizedTag;
    }
    return `${prefix}/${value}` as NormalizedTag;
  }
  if (!hasEdgeWhitespace(tag)) {
    return tag.length > 0 ? (tag as NormalizedTag) : null;
  }
  const trimmed = tag.trim();
  if (trimmed.length === 0) return null;
  if (trimmed === tag) return tag as NormalizedTag;
  return trimmed as NormalizedTag;
}

/** タグを正規形へ寄せる（ADR-0005 決定5）。正規化して空になる入力は null。 */
export function normalizeTag(tag: string): NormalizedTag | null {
  const cache = activeNormalizeTagBatchCache;
  if (cache === null) {
    return normalizeTagCore(tag);
  }
  if (cache.has(tag)) {
    return cache.get(tag)!;
  }
  const result = normalizeTagCore(tag);
  cache.set(tag, result);
  return result;
}

/** DB 読み出し境界用。正規形かどうかは normalizeTag の結果が入力と同一かで判定する（判定の正本は normalizeTag のみ）。 */
export function isTagNormalized(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return normalized !== null && normalized === tag;
}

/** ローカル検証スクリプト互換。判定は isTagNormalized と同一（正本は normalizeTag のみ）。 */
export const isStoredTagNormalized = isTagNormalized;

export type StoredNormalizedTagsResult =
  | { ok: true; value: NormalizedTag[] }
  | { ok: false; index: number; message: string };

/** DB 読み出し境界用。正規形なら参照をそのまま返し、違反時だけ詳細メッセージを構築する。 */
export function parseStoredNormalizedTags(tags: string[]): StoredNormalizedTagsResult {
  const value: NormalizedTag[] = new Array(tags.length);
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    const normalized = normalizeTag(tag);
    if (normalized === null) {
      return { ok: false, index: i, message: `タグを正規化できません: ${JSON.stringify(tag)}` };
    }
    if (normalized !== tag) {
      return { ok: false, index: i, message: `タグが正規化されていません: ${JSON.stringify(tag)}` };
    }
    value[i] = normalized;
  }
  return { ok: true, value };
}

/** DB 読み出し・API 応答など、書き込み境界を経由済みのタグ配列を検証する。各要素が
 *  normalizeTag と同じ正規形であることを要求し、違反時は呼び出し側の parseRecord が
 *  PersistentDataError に変換する（黙って正規化しない）。 */
export const normalizedTagArraySchema = z.array(z.string()).transform((tags, ctx) => {
  const parsed = parseStoredNormalizedTags(tags);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", path: [parsed.index], message: parsed.message });
    return z.NEVER;
  }
  return parsed.value;
});

/** 組み込み軸の擬似タグ専用の予約文字（ADR-0012 §2）。実タグでの使用は禁止する */
export const RESERVED_TAG_PREFIX = "@";

/** 実タグの書き込み検証。判定はすべて normalizeTag した後の値に対して行う。 */
export const tagSchema = z
  .string()
  .refine((tag) => normalizeTag(tag) !== null, {
    message: "空になるタグは登録できません",
  })
  .refine((tag) => !(normalizeTag(tag)?.startsWith(RESERVED_TAG_PREFIX) ?? false), {
    message: `タグを予約文字 "${RESERVED_TAG_PREFIX}" から始めることはできません`,
  });

/** 正規化できないタグが配列に含まれるときに投げる。 */
export class TagNormalizationError extends Error {
  readonly tag: string;

  constructor(tag: string) {
    super(`タグを正規化できません: ${JSON.stringify(tag)}`);
    this.name = "TagNormalizationError";
    this.tag = tag;
  }
}

/** 各要素を正規形へ寄せる。正規化して空になる要素は TagNormalizationError を投げる。 */
export function normalizeTags(tags: string[]): NormalizedTag[] {
  const result: NormalizedTag[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized === null) throw new TagNormalizationError(tag);
    result.push(normalized);
  }
  return result;
}

/** 正規化済みタグ配列から重複を除く（順序は保持）。 */
export function dedupeTags(tags: Iterable<NormalizedTag>): NormalizedTag[] {
  const seen = new Set<NormalizedTag>();
  const result: NormalizedTag[] = [];
  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

/** HTTP 書き込み境界用。tagSchema で検証し正規形へ変換してから重複を除く。 */
export const normalizedTagInputArraySchema = z
  .array(tagSchema)
  .transform((tags) => dedupeTags(normalizeTags(tags)));
