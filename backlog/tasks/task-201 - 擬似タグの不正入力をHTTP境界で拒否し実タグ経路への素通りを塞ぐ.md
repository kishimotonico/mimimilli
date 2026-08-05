---
id: TASK-201
title: 擬似タグの不正入力をHTTP境界で拒否し実タグ経路への素通りを塞ぐ
status: To Do
assignee: []
created_date: '2026-08-05 12:58'
labels: []
dependencies: []
priority: high
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fable によるレビュー（2026-08-05、Codex 2回目指摘への判断）で確定したマージ前修正。統括が該当コードを読んで裏取り済み。

Codex は「URL用の警告正規化とHTTP用の厳格スキーマを分けよ」と提案したが、URL側の警告付き正規化は navigationUrl.ts で TASK-198 において実装済み。足りないのは HTTP 側の厳格化だけであり、提案の枠組みをそのまま採ると過大になる。以下のスコープに絞る。

## 1. 擬似タグとして解釈できない @ 始まりの文字列が実タグへ素通りする

shared/src/pseudoTag.ts の parseBuiltinAxisTag は、@year（スラッシュなし）・@year/（末尾スラッシュ）・@/2024（軸が空）のような文字列に対して null を返す。その結果 splitSelectedTags はこれらを実タグとして tags へ積む。

実タグは tagSchema により @ で始まれないため、AND 絞り込みでは必ず0件になる。ユーザーから見ると「チップは出ているのに結果が空」という、TASK-198 で潰したはずの状態が別経路で残っている。

これらを warnings へ積んで拒否し、実タグ経路へ流さないようにする。

## 2. HTTP 境界での厳格化

shared/src/api.ts の worksQuerySchema（および smartFolderWorksQuerySchema・axisFacetsQuerySchema）で、splitSelectedTags が warnings を返す入力を superRefine で拒否し 400 invalid_request にする。

サーバー側（worksQuery.ts の resolveTagFilters、workRepo.ts）が warnings を捨てている構造は、スキーマ入口で400にすれば実質的に解消される。

year 値の ^\d{4}$ 検証もここに含める（現在 @year/banana は黙って0件になる）。

重要な制約: 既存の shared 実装（splitSelectedTags）を呼び回すだけにし、新しい検証系を並立させないこと。検証ロジックが2箇所に分かれると、今回のような食い違いが再発する。

## 3. ついで対応

shared/src/library.ts の smartFolderRuleSchema の values を、作品側（workPatchSchema）と同じく .transform(normalizeTags) で正規形保存に揃える。現在は tagSchema による検証は通るが正規化されていない。

対象: shared/src/pseudoTag.ts / shared/src/api.ts / shared/src/library.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @year・@year/・@/2024 のような擬似タグとして解釈できない @ 始まりの文字列が warnings へ積まれ、実タグ経路へ流れない
- [ ] #2 worksQuerySchema が splitSelectedTags の warnings を伴う入力を拒否し 400 になる
- [ ] #3 smartFolderWorksQuerySchema と axisFacetsQuerySchema も同様に拒否する
- [ ] #4 @year/banana のような 4桁数字でない year 値が拒否される
- [ ] #5 検証が shared の splitSelectedTags を呼ぶ形に一本化されており、別系統の検証実装が並立していない
- [ ] #6 smartFolderRuleSchema の values が normalizeTags で正規形保存される
- [ ] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
