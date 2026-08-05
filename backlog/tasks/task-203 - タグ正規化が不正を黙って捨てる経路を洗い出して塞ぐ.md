---
id: TASK-203
title: タグ正規化が不正を黙って捨てる経路を洗い出して塞ぐ
status: To Do
assignee: []
created_date: '2026-08-05 14:58'
labels: []
dependencies: []
priority: medium
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ再設計で予約文字契約（ADR-0012 §2）を導入した結果、同じ系統のバグが TASK-198・TASK-201・TASK-202 と3回にわたって別経路で見つかった。いずれも「正規化前の値で判定していた」ことが原因で、症状はどれも『チップは表示されているのに絞り込みが効かず結果が空』だった。

TASK-202 で parseBuiltinAxisTag を正規化後判定に統一し、擬似タグ側の判定は閉じる見込み。本タスクでは残るもう一方の隠蔽経路を整理する。

## 問題

shared/src/work.ts の normalizeTags は、正規化後に空になるタグと重複を警告なしに捨てる。この関数は22箇所から呼ばれており、多くは DLsite 連携のタグマージ経路である。

- client/src/entities/work/editableTags.ts
- client/src/features/library/model/dlsitePreview.ts
- server/src/adapters/real/workRegister.ts / index.ts / dlsite.ts / workRepo.ts
- server/src/adapters/fixture/index.ts

TASK-196 で書き込み入口（workPatchSchema・workCreateBodySchema・metaFileSchema）に tagSchema を通したが、これら22箇所が**すべて tagSchema を通った後の値を扱っているのか**は未確認である。通っていない経路があれば、そこは予約文字契約の外側になる。

AGENTS.md は「エラーは正しくハンドリングし問題を隠蔽しない」「過度なフォールバックは禁止」としており、黙って捨てる実装はこれに反する。

## やること

1. normalizeTags の呼び出し元22箇所を調査し、それぞれの入力が tagSchema による検証を通った値かどうかを分類する
2. 検証を通っていない経路があれば、入口で検証するか、normalizeTags 側でエラーにするかを判断して塞ぐ
3. 調査の結果「すべて検証済みの値しか来ない」と分かった場合は、normalizeTags のコメントにその前提を明記し、防御的フィルタとしての黙った除去が妥当である理由を残す（そのうえで除去自体をやめられるなら、やめる）

## やらないこと（判断の記録）

タグ文字列に branded type（NormalizedTag 等）を導入して型で正規化済みを保証する案も検討したが、今回は採らない。22箇所の呼び出し元すべてに波及し、ライブラリ再設計ブランチの終盤に入れる変更としては規模とリスクが見合わない。上記1〜3で経路が閉じるなら、型による保証がなくても再発は防げる。将来タグ関連で同種のバグが再発したときに再検討する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizeTags の呼び出し元がすべて分類され、tagSchema による検証を通った値かどうかが判明している
- [ ] #2 検証を通っていない書き込み経路があれば塞がれている
- [ ] #3 normalizeTags が黙って値を捨てる挙動について、廃止されているか、前提と理由がコメントに明記されている
- [ ] #4 調査結果と判断が実装ノートに記録されている
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
