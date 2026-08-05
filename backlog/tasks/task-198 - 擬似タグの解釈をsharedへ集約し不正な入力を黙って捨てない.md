---
id: TASK-198
title: 擬似タグの解釈をsharedへ集約し不正な入力を黙って捨てない
status: To Do
assignee: []
created_date: '2026-08-05 10:57'
labels: []
dependencies: []
priority: high
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex による2回目のマージ前レビュー（2026-08-05）の指摘。統括が該当コードを読んで裏取り済み。

## 1. URL復元が擬似タグを無検証で受け入れる

client/src/features/navigation/model/navigationUrl.ts の URL 復元は tags を uniqueNonEmpty で重複除去するだけで、擬似タグとしての妥当性を検証しない。一方 libraryPresentation.ts の splitSelectedTags は条件を黙って捨てる。

- 複数の @year/... は先頭だけを採用（他は無視）
- 未知の組み込み軸（@unknown/... 等）は if (builtin) continue で無条件に破棄

結果、URL とチップ列には2件表示されているのに検索には1件しか効かない、押しても何も変わらないチップが残る、といった状態になる。

これは TASK-184 の受け入れ条件「year 軸は同時に1値のみ選択でき、チップ表示と実際の絞り込みが常に一致する」に反する。UI 側の操作では置き換えが強制されるが、URL 経由でその強制を迂回できてしまう。TASK-185 で「チップは表示されるのに効かない」状態を欠陥として直したのと同じ類のものである。

対応: 擬似タグの構築・解析・検証を shared へ集約し、URL 復元の時点で未知軸・複数 year を警告付きで拒否または正規化する。クエリ生成時に黙って捨てる分岐は不要になるので削除する。

## 2. 3つ目の書き込み経路が検証を通らない

shared/src/library.ts の smartFolderRuleSchema が values: z.array(z.string().min(1)) で tagSchema を通らない。スマートフォルダーのルールから予約文字の擬似タグを注入できる。

TASK-196 で workPatchSchema / workCreateBodySchema / metaFileSchema の3経路を塞いだが、ここが漏れていた。

## 3. 正規化が不正を黙って捨てる

normalizeTags は空文字や cv/（値が空白のみ）といった不正なタグをエラーにせず削除する。AGENTS.md の「エラーは正しくハンドリングし問題を隠蔽しない」に反する。正規化後の非空検証を共通スキーマにまとめ、不正な入力は拒否する。

対象: shared/src/work.ts / shared/src/library.ts / client/src/features/navigation/model/navigationUrl.ts / client/src/features/library/model/libraryPresentation.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 擬似タグの構築・解析・検証が shared に集約され、client と server が同じ実装を使う
- [ ] #2 URL に未知の組み込み軸の擬似タグが含まれるとき、警告付きで拒否され、効かないチップが残らない
- [ ] #3 URL に複数の year 擬似タグが含まれるとき、警告付きで正規化され、チップ表示と実際の絞り込みが一致する
- [ ] #4 splitSelectedTags から条件を黙って捨てる分岐が無くなっている
- [ ] #5 smartFolderRuleSchema のタグ値が tagSchema による検証を通る
- [ ] #6 正規化後に空になるタグが黙って削除されず、エラーとして扱われる
- [ ] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
