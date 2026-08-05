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

/** year 擬似タグの値（addedAt の年）は4桁の数字のみ許容する */
const YEAR_VALUE_PATTERN = /^\d{4}$/;

export interface SplitSelectedTagsResult {
  /** 実タグとして work.tags と完全一致させるもの */
  tags: string[];
  /** year 軸から選ばれた addedAt の年（複数選択は仕様上 AND が常に0件になるため先頭のみ採用） */
  yearValue: string | null;
  /** 拒否・正規化などで入力の一部を捨てたときの理由。呼び出し側（URL復元・HTTPスキーマの
   *  境界検証等）がログ・拒否判定に使う。空配列なら入力はすべてそのまま採用された */
  warnings: string[];
}

/**
 * 選択中タグ（selectedTagsAtom・URLの tags=・HTTPクエリの tags=）を実タグと組み込み軸の
 * 擬似タグへ分解する共通入口。client（URL復元）・server（HTTPスキーマの境界検証・フィルタ
 * 解釈）が同じ実装を使う。不正な入力は黙って無視・素通りさせず warnings へ積んで拒否する:
 *   - 正規化して初めて "@" 始まりになる入力（例: 先頭に空白を挟んだ " @year/2024"）。
 *     予約文字は自前のコードだけが生成するため、正規化前から "@" 始まりでない入力は
 *     壊れた入力として拒否し、直して受け入れることはしない
 *   - "@" で始まるが擬似タグとして解釈できない形（@year・@year/・@/2024 等）
 *   - 未知の組み込み軸の擬似タグ
 *   - 4桁の数字でない year 値（@year/banana 等）
 *   - 複数の year 擬似タグ（2件目以降）
 *   - 正規化後に空になるタグ
 * UI操作は常に置き換え・単一選択を強制するが、URL・HTTPクエリは直接編集され得るため、
 * ここで同じ制約を検証する（ADR-0012 §2）。
 */
export function splitSelectedTags(selectedTags: string[]): SplitSelectedTagsResult {
  let yearValue: string | null = null;
  const tags: string[] = [];
  const warnings: string[] = [];

  for (const rawTag of selectedTags) {
    // 予約プレフィックス判定は tagSchema と同様、必ず正規化後の値に対して行う。生文字列判定だと
    // 先頭に空白を挟んだ " @year/2024" が素通りし、下の実タグ分岐で normalizeTag が
    // "@year/2024" へ正規化した値を無警告で実タグとして積んでしまう。
    const normalized = normalizeTag(rawTag);
    if (normalized.startsWith(RESERVED_TAG_PREFIX)) {
      // 予約文字は自前のコードだけが生成するため、正規化前から "@" 始まりでない入力
      // （先頭に空白を挟む等）は壊れた入力として拒否する。正規化すれば有効な擬似タグに
      // 「直る」場合でも黙って修復しない（不正を隠蔽しない方針と一貫させる）。
      if (!rawTag.startsWith(RESERVED_TAG_PREFIX)) {
        warnings.push(`予約文字混じりの不正な入力を拒否しました: ${rawTag}`);
        continue;
      }
      const builtin = parseBuiltinAxisTag(normalized);
      if (!builtin) {
        warnings.push(`擬似タグとして解釈できない入力を拒否しました: ${rawTag}`);
        continue;
      }
      if (!isBuiltinPseudoTagAxis(builtin.axis)) {
        warnings.push(`未知の組み込み軸の擬似タグを拒否しました: ${rawTag}`);
        continue;
      }
      if (!YEAR_VALUE_PATTERN.test(builtin.value)) {
        warnings.push(`year擬似タグの値が4桁の数字ではありません: ${rawTag}`);
        continue;
      }
      if (yearValue !== null) {
        warnings.push(`複数の year 擬似タグのうち先頭だけを採用しました: ${rawTag}`);
        continue;
      }
      yearValue = builtin.value;
      continue;
    }
    if (!normalized) {
      warnings.push(`正規化後に空になるタグを拒否しました: ${rawTag}`);
      continue;
    }
    tags.push(normalized);
  }

  return { tags, yearValue, warnings };
}
