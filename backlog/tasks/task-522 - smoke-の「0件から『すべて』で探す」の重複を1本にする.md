---
id: TASK-522
title: smoke の「0件から『すべて』で探す」の重複を1本にする
status: To Do
assignee: []
created_date: '2026-11-23 21:30'
labels:
  - test
dependencies: []
priority: low
ordinal: 641000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/tests/smoke/library.smoke.spec.ts の値一覧の0件と、お気に入りの0件の「『すべて』で探す」のテストが同じことを繰り返している（TASK-517 の Fable の最終レビュー）。smoke は重いので、片方にチップありの確認を足してもう片方を消す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 「0件から『すべて』で探す」を確かめる smoke が1本で、チップと検索語が引き継がれることを確かめている
- [ ] #2 pnpm test:smoke が通る
<!-- AC:END -->
