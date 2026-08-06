// DB 読み出し境界のタグ正規形判定（parseStoredNormalizedTags / isTagNormalized）。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getNormalizeTagBatchCacheStateForTests,
  isTagNormalized,
  normalizeTag,
  parseStoredNormalizedTags,
  withNormalizeTagBatchCache,
} from "@mimimilli/shared";

const UNICODE_BOUNDARY_FALSE_POSITIVES = [
  "cv　/全角スペース区切り",
  "cv/全角スペース　",
  "　cv/前full-width space",
  "ＣＶ/full-widthUppercase",
  "cv/value\u00a0",
  "\ufeffcv/bom-prefix",
] as const;

test("Unicode 境界値: 非正規タグを isTagNormalized / parseStoredNormalizedTags が検知する", () => {
  for (const tag of UNICODE_BOUNDARY_FALSE_POSITIVES) {
    assert.equal(isTagNormalized(tag), false, `isTagNormalized: ${JSON.stringify(tag)}`);
    const normalized = normalizeTag(tag);
    assert.notEqual(normalized, tag, `normalizeTag は入力と異なる: ${JSON.stringify(tag)}`);
    const parsed = parseStoredNormalizedTags([tag]);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.message, /正規化されていません/);
    }
  }
});

test("isTagNormalized は normalizeTag の同一性判定と常に一致する", () => {
  const corpus = buildTagValidationCorpus();
  for (const tag of corpus) {
    const normalized = normalizeTag(tag);
    const expected = normalized !== null && normalized === tag;
    assert.equal(
      isTagNormalized(tag),
      expected,
      `isTagNormalized mismatch for ${JSON.stringify(tag)}`,
    );
  }
});

test("parseStoredNormalizedTags は normalizeTag 基準で受理・拒否を判定する", () => {
  const corpus = buildTagValidationCorpus();
  for (const tag of corpus) {
    const normalized = normalizeTag(tag);
    const parsed = parseStoredNormalizedTags([tag]);
    if (normalized === null) {
      assert.equal(parsed.ok, false);
      if (!parsed.ok) assert.match(parsed.message, /正規化できません/);
    } else if (normalized !== tag) {
      assert.equal(parsed.ok, false);
      if (!parsed.ok) assert.match(parsed.message, /正規化されていません/);
    } else {
      assert.equal(parsed.ok, true);
      if (parsed.ok) assert.equal(parsed.value[0], tag);
    }
  }
});

test("withNormalizeTagBatchCache: 正常終了後にキャッシュがスコープ外へ漏れない", () => {
  withNormalizeTagBatchCache(() => {
    normalizeTag("cv/テスト");
    assert.equal(getNormalizeTagBatchCacheStateForTests().active, true);
    assert.equal(getNormalizeTagBatchCacheStateForTests().size, 1);
  });
  assert.deepEqual(getNormalizeTagBatchCacheStateForTests(), { active: false, size: 0 });
});

test("withNormalizeTagBatchCache: 例外時もキャッシュがスコープ外へ漏れない", () => {
  assert.throws(() => {
    withNormalizeTagBatchCache(() => {
      normalizeTag("cv/テスト");
      throw new Error("batch failed");
    });
  }, /batch failed/);
  assert.deepEqual(getNormalizeTagBatchCacheStateForTests(), { active: false, size: 0 });
});

test("withNormalizeTagBatchCache: ネスト終了後に外側のキャッシュが復元される", () => {
  withNormalizeTagBatchCache(() => {
    normalizeTag("outer/tag");
    assert.equal(getNormalizeTagBatchCacheStateForTests().size, 1);
    withNormalizeTagBatchCache(() => {
      normalizeTag("inner/tag");
      assert.equal(getNormalizeTagBatchCacheStateForTests().size, 1);
    });
    assert.equal(getNormalizeTagBatchCacheStateForTests().size, 1);
    assert.equal(normalizeTag("outer/tag"), "outer/tag");
  });
});

test("normalizeTag バッチキャッシュは判定結果を変えない", () => {
  const corpus = buildTagValidationCorpus();
  for (const tag of corpus) {
    const baseline = normalizeTag(tag);
    withNormalizeTagBatchCache(() => {
      const cold = normalizeTag(tag);
      const warm = normalizeTag(tag);
      assert.equal(cold, warm, `memo mismatch for ${JSON.stringify(tag)}`);
      assert.equal(cold, baseline);
    });
    const reparsed = parseStoredNormalizedTags([tag]);
    withNormalizeTagBatchCache(() => {
      const parsed = parseStoredNormalizedTags([tag]);
      assert.deepEqual(reparsed, parsed);
    });
  }
});

test("高カーディナリティでも parseStoredNormalizedTags の判定は正しい", () => {
  const tags = Array.from({ length: 25_000 }, (_, i) => `カテゴリ${i % 200}/固有値${i}`);
  withNormalizeTagBatchCache(() => {
    const parsed = parseStoredNormalizedTags(tags);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.length, tags.length);
      assert.equal(parsed.value[0], tags[0]);
      assert.equal(parsed.value.at(-1), tags.at(-1));
    }
  });
  assert.deepEqual(getNormalizeTagBatchCacheStateForTests(), { active: false, size: 0 });
});

function buildTagValidationCorpus(): string[] {
  const seeds = [
    "cv/水瀬なずな",
    "ASMR",
    "シリーズ/A/B",
    "普通のタグ",
    "genre/耳かき",
    "café/foo",
    "@axis/value",
    "",
    " ",
    "cv/",
    "cv/   ",
    " CV/壊れ ",
    ...UNICODE_BOUNDARY_FALSE_POSITIVES,
  ];
  const whitespace = [" ", "\t", "\u3000", "\u00a0", "\ufeff"];
  const prefixCases = ["cv", "CV", "ＣＶ", " Genre ", "cv　"];
  const valueCases = ["正常", " Alice ", "全角スペース　", "value\u00a0", "A/B"];
  const corpus = new Set<string>(seeds);

  for (const prefix of prefixCases) {
    for (const value of valueCases) {
      corpus.add(`${prefix}/${value}`);
      for (const lead of whitespace) {
        for (const trail of whitespace) {
          corpus.add(`${lead}${prefix}/${value}${trail}`);
        }
      }
    }
  }

  for (const seed of [...corpus]) {
    const normalized = normalizeTag(seed);
    if (normalized !== null) corpus.add(normalized);
    corpus.add(seed.toUpperCase());
    corpus.add(seed.toLowerCase());
    if (seed.includes("/")) {
      const slash = seed.indexOf("/");
      const p = seed.slice(0, slash);
      const rest = seed.slice(slash + 1);
      corpus.add(` ${p}/${rest} `);
      corpus.add(`${p.toUpperCase()}/${rest}`);
    } else {
      corpus.add(` ${seed} `);
    }
  }

  return [...corpus];
}
