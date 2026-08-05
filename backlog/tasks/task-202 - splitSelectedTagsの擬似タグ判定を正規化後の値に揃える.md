---
id: TASK-202
title: splitSelectedTagsの擬似タグ判定を正規化後の値に揃える
status: Done
assignee:
  - impl-182
created_date: '2026-08-05 14:52'
updated_date: '2026-08-05 15:04'
labels: []
dependencies: []
priority: high
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fable による追加指摘（2026-08-05）。統括が該当コードを読んで裏取り済み。TASK-201 の対応に残った穴。

## 問題

shared/src/pseudoTag.ts の splitSelectedTags は rawTag.startsWith(RESERVED_TAG_PREFIX) と生文字列で擬似タグかを判定している。そのため先頭に空白を挟んだ " @year/2024" は擬似タグ判定を素通りし、else 側で normalizeTag が "@year/2024" へ正規化した値を、警告なしで実タグとして tags へ積む。

実タグは @ で始まれない（tagSchema が拒否する）ので、この値での AND 絞り込みは必ず0件になる。TASK-198・TASK-201 で潰してきた「チップは出ているのに結果が空」がまた別経路で残っている。

shared/src/work.ts の tagSchema は、まさにこのトリックを警戒して判定をすべて normalizeTag 後の値に対して行うようにしてある（同ファイルのコメントに明記）。splitSelectedTags だけ生文字列判定なのは不整合。

## 対応方針（統括判断）

判定を正規化後の値に揃える。正規化後の値が RESERVED_TAG_PREFIX で始まる場合は warnings へ積んで拒否し、実タグ経路へ流さない。

なお「正規化した結果が有効な擬似タグになるなら受け入れる」という選択肢も考えられるが採らない。予約文字は自前のコードだけが生成するものであり、空白混じりの入力は壊れた入力である。黙って修復せず拒否するほうが、不正を隠蔽しない方針と一貫する。

修正は1行程度＋テスト1件で済む見込み。

対象: shared/src/pseudoTag.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 先頭に空白を挟んだ擬似タグ（例: 半角スペース + @year/2024）が warnings へ積まれ、実タグ経路へ流れない
- [x] #2 擬似タグかどうかの判定が正規化後の値に対して行われ、tagSchema と同じ考え方に揃っている
- [x] #3 上記が単体テストで検証されている
- [x] #4 HTTP 境界でも同じ入力が 400 になる（refineTagWarnings 経由で自動的に効くことの確認）
- [x] #5 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
