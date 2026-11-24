---
id: TASK-522
title: smoke の「0件から『すべて』で探す」の重複を1本にする
status: In Progress
assignee: []
created_date: '2026-11-23 21:30'
updated_date: '2026-11-24 00:41'
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
- [x] #1 「0件から『すべて』で探す」を確かめる smoke が1本で、チップと検索語が引き継がれることを確かめている
- [x] #2 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
値一覧側のテストを残し、クイックオーバーレイのAND追加でチップを足したうえで0件→「すべて」で探すを確認する形にした。URLのq・検索欄の値・「すべて」選択・チップの引き継ぎを検証。お気に入り側は削除（検索欄の値の確認は新テストへ移した）。チップありの空文言は「…と選択中の絞り込みに一致する作品はありません」。
<!-- SECTION:NOTES:END -->
