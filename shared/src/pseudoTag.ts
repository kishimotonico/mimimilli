// タグ由来でない組み込み軸（year等）の擬似タグ（ADR-0012 §2）の構築・解析・検証。
// client（URL復元・結果面の絞り込みクエリ組み立て）と server（フィルタ解釈層）が
// 同じ実装を共有する。予約文字 "@" は work.ts の RESERVED_TAG_PREFIX と共通。
import { normalizeTag, RESERVED_TAG_PREFIX } from "./work.ts";

/** タグ由来でない組み込み軸（year のみ。addedAt の年照合）。実タグと衝突するため擬似タグ化する。
 *  異なる2値のANDは常に0件になるため、複数選択も許さない（新しい値が前の選択を置き換える）。 */
export function isBuiltinPseudoTagAxis(axis: string): axis is "year" {
  return axis === "year";
}

/** 組み込み軸の値選択を擬似タグ文字列に組み立てる */
export function buildBuiltinAxisTag(axis: string, value: string): string {
  return `${RESERVED_TAG_PREFIX}${axis}/${value}`;
}

export interface ParsedBuiltinAxisTag {
  axis: string;
  value: string;
}

/** 擬似タグ文字列を軸と値に分解する。擬似タグでなければ null（軸が既知かどうかは見ない） */
export function parseBuiltinAxisTag(tag: string): ParsedBuiltinAxisTag | null {
  if (!tag.startsWith(RESERVED_TAG_PREFIX)) return null;
  const rest = tag.slice(RESERVED_TAG_PREFIX.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex <= 0 || slashIndex === rest.length - 1) return null;
  return { axis: rest.slice(0, slashIndex), value: rest.slice(slashIndex + 1) };
}

export interface SplitSelectedTagsResult {
  /** 実タグとして work.tags と完全一致させるもの */
  tags: string[];
  /** year 軸から選ばれた addedAt の年（複数選択は仕様上 AND が常に0件になるため先頭のみ採用） */
  yearValue: string | null;
  /** 拒否・正規化などで入力の一部を捨てたときの理由。呼び出し側（URL復元等）が
   *  ログ・報告に使う。空配列なら入力はすべてそのまま採用された */
  warnings: string[];
}

/**
 * 選択中タグ（selectedTagsAtom・URLの tags=）を実タグと組み込み軸の擬似タグへ分解する。
 * 不正な入力（未知の組み込み軸の擬似タグ、複数の year 擬似タグ、正規化後に空になるタグ）は
 * 黙って無視せず warnings へ積んで拒否する。UI操作は常に置き換え・単一選択を強制するが、
 * URL は直接編集され得るため、ここで同じ制約を検証する（ADR-0012 §2）。
 */
export function splitSelectedTags(selectedTags: string[]): SplitSelectedTagsResult {
  let yearValue: string | null = null;
  const tags: string[] = [];
  const warnings: string[] = [];

  for (const rawTag of selectedTags) {
    const builtin = parseBuiltinAxisTag(rawTag);
    if (builtin) {
      if (!isBuiltinPseudoTagAxis(builtin.axis)) {
        warnings.push(`未知の組み込み軸の擬似タグを拒否しました: ${rawTag}`);
        continue;
      }
      if (yearValue !== null) {
        warnings.push(`複数の year 擬似タグのうち先頭だけを採用しました: ${rawTag}`);
        continue;
      }
      yearValue = builtin.value;
      continue;
    }
    const normalized = normalizeTag(rawTag);
    if (!normalized) {
      warnings.push(`正規化後に空になるタグを拒否しました: ${rawTag}`);
      continue;
    }
    tags.push(normalized);
  }

  return { tags, yearValue, warnings };
}
